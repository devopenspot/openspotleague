import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MapSpot } from "@/lib/types"

const listMock = vi.fn()
const findCityInCountryMock = vi.fn()

vi.mock("@/lib/repositories", () => ({
  getSpotRepositoryAsync: async () => ({
    listForMapScope: listMock,
    list: listMock,
    findCityInCountry: findCityInCountryMock,
  }),
}))

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import { runListSpotsForMapScope } from "./map-country"

function spot(id: string): MapSpot {
  return {
    id,
    slug: `slug-${id}`,
    name: `Spot ${id}`,
    city: "Bogota",
    citySlug: "bogota",
    types: [],
    sports: [],
    image: "",
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 0,
    location: { lat: 4.6, lon: -74.06 },
  }
}

beforeEach(() => {
  listMock.mockReset()
  findCityInCountryMock.mockReset()
  findCityInCountryMock.mockResolvedValue(null)
})

describe("runListSpotsForMapScope", () => {
  it("returns a single page without following the cursor", async () => {
    const items = [spot("1"), spot("2")]
    listMock.mockResolvedValueOnce({ items, nextCursor: null })

    const result = await runListSpotsForMapScope("Colombia")

    expect(result).toEqual(items)
    expect(listMock).toHaveBeenCalledTimes(1)
    expect(listMock).toHaveBeenCalledWith({
      country: "Colombia",
      city: undefined,
      limit: 500,
      cursor: undefined,
    })
  })

  it("pages until the repository cursor is exhausted", async () => {
    const page1 = { items: [spot("1"), spot("2")], nextCursor: "cursor-1" }
    const page2 = { items: [spot("3")], nextCursor: null }
    listMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const result = await runListSpotsForMapScope("Colombia")

    expect(result.map((item) => item.id)).toEqual(["1", "2", "3"])
    expect(listMock).toHaveBeenCalledTimes(2)
    expect(listMock).toHaveBeenNthCalledWith(2, {
      country: "Colombia",
      city: undefined,
      limit: 500,
      cursor: "cursor-1",
    })
  })

  it("scopes the repository query to the requested city slug", async () => {
    const items = [spot("1")]
    listMock.mockResolvedValueOnce({ items, nextCursor: null })

    const result = await runListSpotsForMapScope("Colombia", "bogota")

    expect(result).toEqual(items)
    expect(findCityInCountryMock).toHaveBeenCalledWith("Colombia", "bogota")
    expect(listMock).toHaveBeenCalledWith({
      country: "Colombia",
      city: "bogota",
      limit: 500,
      cursor: undefined,
    })
  })

  it("includes 28km cityRadius when canonical city coordinates are available", async () => {
    const items = [spot("1")]
    findCityInCountryMock.mockResolvedValueOnce({
      slug: "bogota",
      name: "Bogotá",
      lat: 4.65,
      lon: -74.08,
    })
    listMock.mockResolvedValueOnce({ items, nextCursor: null })

    const result = await runListSpotsForMapScope("Colombia", "bogota")

    expect(result).toEqual(items)
    expect(listMock).toHaveBeenCalledWith({
      country: "Colombia",
      city: "bogota",
      cityRadius: {
        lat: 4.65,
        lon: -74.08,
        radiusMeters: 28_000,
      },
      limit: 500,
      cursor: undefined,
    })
  })

  it("returns an empty list for a country without spots", async () => {
    listMock.mockResolvedValueOnce({ items: [], nextCursor: null })

    await expect(runListSpotsForMapScope("Nowhere")).resolves.toEqual([])
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it("stops at the page safety valve instead of looping forever", async () => {
    listMock.mockImplementation(() =>
      Promise.resolve({
        items: [spot("x")],
        nextCursor: "always",
      }),
    )

    const result = await runListSpotsForMapScope("Colombia")

    expect(listMock).toHaveBeenCalledTimes(20)
    expect(result).toHaveLength(20)
  })
})
