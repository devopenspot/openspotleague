import { describe, expect, it } from "vitest"
import { ContentSourceSpotSchema } from "@/lib/schemas/content-source"
import { loadContentSources } from "./content"
import { validateSpots } from "./spots-migration"

describe("canonical content sources", () => {
  it("validates the expected source counts and stable identifiers", () => {
    const content = loadContentSources()

    expect(content.spots.length).toBeGreaterThan(0)
    expect(content.spotTypeAssignments.length).toBeGreaterThan(0)
    expect(new Set(content.spots.map((spot) => spot.id)).size).toBe(content.spots.length)
    expect(content.spots.every((spot) => spot.location.lat >= -90 && spot.location.lat <= 90)).toBe(true)
    expect(content.spots.every((spot) => spot.citySlug.length > 0 && spot.address.length > 0)).toBe(true)
  })

  it("keeps source JSON snake_case and rejects DTO-shaped keys", () => {
    const content = loadContentSources()
    const source = {
      id: content.spots[0]!.id,
      slug: content.spots[0]!.slug,
      name: content.spots[0]!.name,
      city: content.spots[0]!.city,
      city_slug: content.spots[0]!.citySlug,
      address: content.spots[0]!.address,
      image_url: content.spots[0]!.imageUrl,
      images: [...content.spots[0]!.images],
      country_code: content.spots[0]!.countryCode,
      location: "0101000020E610000000000000000000000000000000000000",
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      instagram: content.spots[0]!.instagram,
      verification_count: content.spots[0]!.verificationCount,
      sports: ["Skateboard"],
    }

    expect(ContentSourceSpotSchema.safeParse(source).success).toBe(true)
    expect(
      ContentSourceSpotSchema.safeParse({
        ...source,
        citySlug: source.city_slug,
      }).success,
    ).toBe(false)
  })

  it("validates offline spots dataset and returns accurate metrics via validateSpots", () => {
    const result = validateSpots({ limit: 100 })
    expect(result.ok).toBe(true)
    expect(result.totalSpots).toBe(100)
    expect(result.uniqueCountries).toBeGreaterThan(0)
    expect(result.bounds.minLat).toBeGreaterThanOrEqual(-90)
    expect(result.bounds.maxLat).toBeLessThanOrEqual(90)
  })
})
