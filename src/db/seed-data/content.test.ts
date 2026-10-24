import { describe, expect, it } from "vitest"
import { ContentSourceSpotSchema } from "@/lib/schemas/content-source"
import { loadContentSources } from "./content"
import { validateSpots } from "./spots-migration"
import { REGION_SEED, CITY_SEED } from "./regions"
import { buildCountrySeed } from "./countries"
import {
  SPOT_TYPE_SEED,
  SPORT_DISCIPLINE_SEED,
  EVENT_CATEGORY_SEED,
  EVENT_PLAN_SEED,
} from "./taxonomy"
import { PERMISSION_SEED, ROLE_SEED } from "./rbac"
import { GAME_DEFINITIONS } from "@/lib/games/definitions"

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

  it("validates all decoupled JSON seeds and their referential integrity", () => {
    // Regions & Countries
    expect(REGION_SEED.length).toBe(12)
    const countries = buildCountrySeed()
    expect(countries.length).toBe(143)
    const regionNames = new Set(REGION_SEED.map((r: { name: string }) => r.name))
    for (const country of countries) {
      if (country.region) {
        expect(regionNames.has(country.region)).toBe(true)
      }
    }
    const countryCodes = new Set(countries.map((c: { iso2: string }) => c.iso2))

    // Cities
    expect(CITY_SEED.length).toBeGreaterThan(17000)
    for (const city of CITY_SEED.slice(0, 100)) {
      expect(countryCodes.has(city.countryCode)).toBe(true)
      expect(city.slug.length).toBeGreaterThan(0)
      expect(city.name.length).toBeGreaterThan(0)
    }

    // Taxonomy Dimensions
    expect(SPOT_TYPE_SEED.length).toBe(14)
    expect(SPORT_DISCIPLINE_SEED.length).toBe(4)
    expect(EVENT_CATEGORY_SEED.length).toBe(5)
    expect(EVENT_PLAN_SEED.length).toBe(3)
    expect(EVENT_PLAN_SEED.some((p: { slug: string; isDefault: boolean }) => p.slug === "free" && p.isDefault)).toBe(true)

    // RBAC
    expect(PERMISSION_SEED.length).toBe(10)
    expect(ROLE_SEED.length).toBe(5)
    const permissionSlugs = new Set(PERMISSION_SEED.map((p: { slug: string }) => p.slug))
    for (const role of ROLE_SEED) {
      for (const perm of role.permissions) {
        expect(permissionSlugs.has(perm)).toBe(true)
      }
    }

    // Game Definitions
    const disciplineSlugs = new Set(SPORT_DISCIPLINE_SEED.map((d: { slug: string }) => d.slug))
    for (const [slug, def] of Object.entries(GAME_DEFINITIONS)) {
      expect(disciplineSlugs.has(slug)).toBe(true)
      expect((def as { wordLength: number; eliminationWord: string }).wordLength).toBe(
        (def as { wordLength: number; eliminationWord: string }).eliminationWord.length,
      )
    }
  })
})
