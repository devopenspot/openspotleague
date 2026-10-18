import { describe, expect, it } from "vitest"
import { groupSpotsByCountry, type GameSpot } from "@/lib/games/spot-order"

const spot = (id: string, country: string, lat: number, name: string): GameSpot => ({ id, name, city: "City", country, types: [], location: { lat, lon: 0 } })

describe("game spot ordering", () => {
  it("groups countries and sorts each group nearest-first", () => {
    const groups = groupSpotsByCountry([spot("far", "Canada", 2, "Far"), spot("near", "Canada", 0.1, "Near"), spot("other", "United States", 0.2, "Other")], { lat: 0, lon: 0 })
    expect(groups.map((group) => group.country)).toEqual(["Canada", "United States"])
    expect(groups[0]?.spots.map((item) => item.id)).toEqual(["near", "far"])
  })

  it("uses deterministic alphabetical fallback without location", () => {
    const groups = groupSpotsByCountry([spot("z", "Canada", 0, "Zulu"), spot("a", "Canada", 0, "Alpha")], null)
    expect(groups[0]?.spots.map((item) => item.id)).toEqual(["a", "z"])
    expect(groups[0]?.spots[0]?.distanceMeters).toBeNull()
  })
})
