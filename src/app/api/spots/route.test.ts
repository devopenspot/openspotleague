import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const listSpotsMock = vi.fn()

vi.mock("@/lib/services/spot/spots", () => ({
  listSpots: (...args: unknown[]) => listSpotsMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/spots${query}`)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/spots", () => {
  it("returns 200 with the list result for an empty query", async () => {
    const expected = { items: [], nextCursor: null }
    listSpotsMock.mockResolvedValue(expected)
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expected)
  })

  it("coerces comma-separated types into an array", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?types=skatepark,bowl"))
    expect(listSpotsMock).toHaveBeenCalledOnce()
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ types: ["skatepark", "bowl"] })
  })

  it("coerces comma-separated ids into an array", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?ids=a,b,c"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ ids: ["a", "b", "c"] })
  })

  it("coerces the near parameter (lat,lon,radiusMeters) into an object", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?near=45.7,4.8,5000"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({
      near: { lat: 45.7, lon: 4.8, radiusMeters: 5000 },
    })
  })

  it("accepts the map Nearby scope radius (100 mi)", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?near=4.711,-74.0721,160934"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({
      near: { lat: 4.711, lon: -74.0721, radiusMeters: 160934 },
    })
  })

  it("returns 400 for a near radius above the maximum", async () => {
    const res = await GET(makeRequest("?near=4.711,-74.0721,200000"))
    expect(res.status).toBe(400)
    expect(listSpotsMock).not.toHaveBeenCalled()
  })

  it("passes an ISO country code filter to the repository", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?countryCode=CO"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ countryCode: "CO" })
  })

  it("passes a discipline filter to the repository", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?discipline=Skateboard"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ discipline: "Skateboard" })
  })

  it("coerces limit from a string into a number", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?limit=10"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ limit: 10 })
  })

  it("coerces hasImage from a string into a boolean", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    await GET(makeRequest("?hasImage=true"))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ hasImage: true })
  })

  it("returns 400 on invalid hasImage value", async () => {
    const res = await GET(makeRequest("?hasImage=maybe"))
    expect(res.status).toBe(400)
    expect(listSpotsMock).not.toHaveBeenCalled()
  })

  it("forwards an opaque cursor to the service", async () => {
    listSpotsMock.mockResolvedValue({ items: [], nextCursor: null })
    const cursor = "eyJ2IjoxLCJzbHVnIjoiY2VudHJhbCIsImlkIjoiaWQifQ"
    await GET(makeRequest(`?cursor=${cursor}`))
    const call = listSpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ cursor })
  })

  it("returns 400 on invalid query (negative radius)", async () => {
    const res = await GET(makeRequest("?near=45.7,4.8,-1"))
    expect(res.status).toBe(400)
    expect(listSpotsMock).not.toHaveBeenCalled()
  })

  it("returns 400 when the near coordinates are malformed", async () => {
    const res = await GET(makeRequest("?near=91,4.8,5000"))
    expect(res.status).toBe(400)
    expect(listSpotsMock).not.toHaveBeenCalled()
  })

  it("returns 400 on unknown query keys (strict schema)", async () => {
    const res = await GET(makeRequest("?garbage=x"))
    expect(res.status).toBe(400)
  })

  it("returns 500 when the service throws", async () => {
    listSpotsMock.mockRejectedValue(new Error("db down"))
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(500)
  })
})
