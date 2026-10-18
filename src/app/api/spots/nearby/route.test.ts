import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const findNearbySpotsMock = vi.fn()

vi.mock("@/lib/services/spot/spots", () => ({
  findNearbySpots: (...args: unknown[]) => findNearbySpotsMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/spots/nearby${query}`)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/spots/nearby", () => {
  it("returns 200 with the items", async () => {
    findNearbySpotsMock.mockResolvedValue([{ id: "spot-1" }])
    const res = await GET(makeRequest("?lat=45.7&lon=4.8&radiusMeters=1000"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: unknown[] }
    expect(body.items).toEqual([{ id: "spot-1" }])
  })

  it("uses 5000 as the default radius when omitted", async () => {
    findNearbySpotsMock.mockResolvedValue([])
    await GET(makeRequest("?lat=45.7&lon=4.8"))
    const call = findNearbySpotsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ radiusMeters: 5000 })
  })

  it("returns 400 for non-numeric lat", async () => {
    const res = await GET(makeRequest("?lat=abc&lon=4.8"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for out-of-range lat", async () => {
    const res = await GET(makeRequest("?lat=99&lon=4.8"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for non-positive radius", async () => {
    const res = await GET(makeRequest("?lat=45.7&lon=4.8&radiusMeters=0"))
    expect(res.status).toBe(400)
  })

  it("caps the radius at 50000m", async () => {
    const res = await GET(
      makeRequest("?lat=45.7&lon=4.8&radiusMeters=999999"),
    )
    expect(res.status).toBe(400)
  })

  it("returns 500 when the service throws", async () => {
    findNearbySpotsMock.mockRejectedValue(new Error("db down"))
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    expect(res.status).toBe(500)
  })
})
