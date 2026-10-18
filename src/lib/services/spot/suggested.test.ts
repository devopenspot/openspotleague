import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Spot } from "@/lib/types"

const findNearbyPublicMock = vi.fn()

vi.mock("@/lib/repositories", () => ({
  getSpotRepositoryAsync: async () => ({
    findNearbyPublic: findNearbyPublicMock,
  }),
}))

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import { NEARBY_RADIUS_CAP_METERS } from "@/lib/config/constants"
import { listSuggestedSpots, runListSuggestedSpots } from "./suggested"

function spot(id: string, lat = 4.6, lon = -74.06): Spot {
  return {
    id,
    slug: `slug-${id}`,
    name: `Spot ${id}`,
    city: "Bogota",
    citySlug: "bogota",
    address: "calle 1",
    types: [],
    sports: [],
    image: "",
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 0,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat, lon },
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

beforeEach(() => {
  findNearbyPublicMock.mockReset()
})

describe("runListSuggestedSpots", () => {
  it("queries the PostGIS public radius and drops the current spot", async () => {
    const current = spot("current")
    findNearbyPublicMock.mockResolvedValueOnce([
      spot("a"),
      current,
      spot("b"),
    ])

    const result = await runListSuggestedSpots({
      spotId: current.id,
      lat: current.location.lat,
      lon: current.location.lon,
    })

    expect(findNearbyPublicMock).toHaveBeenCalledWith({
      lat: current.location.lat,
      lon: current.location.lon,
      radiusMeters: NEARBY_RADIUS_CAP_METERS,
    })
    expect(result.map((s) => s.id)).toEqual(["a", "b"])
  })

  it("caps the pool instead of shipping the full nearby page", async () => {
    const nearby = Array.from({ length: 40 }, (_, i) => spot(`s${i}`))
    findNearbyPublicMock.mockResolvedValueOnce(nearby)

    const result = await runListSuggestedSpots({
      spotId: "current",
      lat: 4.6,
      lon: -74.06,
    })

    expect(result).toHaveLength(30)
  })

  it("returns an empty pool for a spot without finite coordinates", async () => {
    const result = await runListSuggestedSpots({
      spotId: "current",
      lat: Number.NaN,
      lon: Number.NaN,
    })

    expect(result).toEqual([])
    expect(findNearbyPublicMock).not.toHaveBeenCalled()
  })

  it("caches on the spot id/coordinates key and carries the spots:list tag", async () => {
    const current = spot("current")
    findNearbyPublicMock.mockResolvedValueOnce([])

    await listSuggestedSpots({
      spotId: current.id,
      lat: current.location.lat,
      lon: current.location.lon,
    })

    expect(findNearbyPublicMock).toHaveBeenCalledTimes(1)
  })
})
