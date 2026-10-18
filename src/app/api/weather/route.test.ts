import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const listSpotsMock = vi.fn()
const getSpotWeatherMock = vi.fn()

vi.mock("@/lib/services/spot/spots", () => ({
  listSpots: (...args: unknown[]) => listSpotsMock(...args),
}))
vi.mock("@/lib/weather/weather-cached", () => ({
  getSpotWeather: (...args: unknown[]) => getSpotWeatherMock(...args),
}))
vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/weather${query}`)
}

const spotA = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slug: "a",
  name: "A",
  city: "City",
  citySlug: "city",
  address: "1 St",
  types: [],
  sports: [],
  image: "",
  country: "X",
  countryCode: "XX",
  location: { lat: 1, lon: 2 },
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}
const spotB = {
  ...spotA,
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  slug: "b",
  name: "B",
  location: { lat: 3, lon: 4 },
}
const weatherA = {
  current: 20,
  icon: "sunny",
  description: "clear",
  tempMin: 18,
  tempMax: 22,
  wind: 3,
  humidity: 50,
  precipitationMm: null,
  fetchedAt: 1000,
}
const weatherB = { ...weatherA, current: 15, icon: "cloudy" }

beforeEach(() => {
  vi.resetAllMocks()
  listSpotsMock.mockResolvedValue({ items: [spotA, spotB], nextCursor: null })
  getSpotWeatherMock.mockImplementation(
    async (args: { spotId: string }) =>
      args.spotId === spotA.id ? weatherA : weatherB,
  )
})

describe("GET /api/weather", () => {
  it("returns 200 with weather for the requested spot ids", async () => {
    const res = await GET(
      makeRequest(
        `?spotIds=${spotA.id},${spotB.id}`,
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      weather: Record<string, unknown>
    }
    expect(body.weather[spotA.id]).toEqual(weatherA)
    expect(body.weather[spotB.id]).toEqual(weatherB)
  })

  it("coerces comma-separated spotIds", async () => {
    await GET(makeRequest(`?spotIds=${spotA.id},${spotB.id}`))
    expect(listSpotsMock).toHaveBeenCalledOnce()
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({
      ids: [spotA.id, spotB.id],
    })
  })

  it("dedupes duplicate ids in the same request", async () => {
    await GET(makeRequest(`?spotIds=${spotA.id},${spotA.id}`))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({
      ids: [spotA.id],
    })
  })

  it("skips unknown spot ids silently", async () => {
    const res = await GET(
      makeRequest(`?spotIds=${spotA.id},unknown-id`),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      weather: Record<string, unknown>
    }
    expect(body.weather[spotA.id]).toEqual(weatherA)
    expect(body.weather["unknown-id"]).toBeUndefined()
  })

  it("calls getSpotWeather with the spot's lat/lon", async () => {
    await GET(makeRequest(`?spotIds=${spotA.id}`))
    expect(getSpotWeatherMock).toHaveBeenCalledWith({
      spotId: spotA.id,
      latitude: spotA.location.lat,
      longitude: spotA.location.lon,
    })
  })

  it("returns 400 when spotIds is missing", async () => {
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(400)
    expect(listSpotsMock).not.toHaveBeenCalled()
  })

  it("returns 400 when the request has more than 50 ids", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`).join(",")
    const res = await GET(makeRequest(`?spotIds=${ids}`))
    expect(res.status).toBe(400)
  })

  it("returns 500 when the spots list service throws", async () => {
    listSpotsMock.mockRejectedValue(new Error("db down"))
    const res = await GET(makeRequest(`?spotIds=${spotA.id}`))
    expect(res.status).toBe(500)
  })
})
