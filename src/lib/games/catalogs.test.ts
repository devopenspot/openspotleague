import { describe, expect, it } from "vitest"
import {
  TRICK_CATALOGS,
  catalogForDiscipline,
  validateTrickCatalog,
} from "@/lib/games/catalogs"
import { SPOT_TYPE_SEED } from "@/db/seed-data/taxonomy"

describe("catalog validation", () => {
  it("keeps every trick discipline aligned with its catalog", () => {
    for (const [slug, catalog] of Object.entries(TRICK_CATALOGS) as [keyof typeof TRICK_CATALOGS, typeof TRICK_CATALOGS.roller][]) {
      for (const trick of catalog.tricks) {
        expect(trick.discipline).toBe(slug)
      }
    }
  })

  it("keeps catalog membership exact per discipline", () => {
    for (const [slug, catalog] of Object.entries(TRICK_CATALOGS) as [keyof typeof TRICK_CATALOGS, typeof TRICK_CATALOGS.roller][]) {
      for (const trick of catalog.tricks) {
        expect(trick.discipline).toBe(slug)
      }
    }
  })

  it("allows repeated source IDs across catalogs but not within one", () => {
    const allIds = Object.values(TRICK_CATALOGS).flatMap((catalog) => catalog.tricks.map((t) => t.id))
    const across = new Map<string, number>()
    for (const id of allIds) across.set(id, (across.get(id) ?? 0) + 1)
    expect([...across.values()].some((count) => count > 1)).toBe(true)
    for (const catalog of Object.values(TRICK_CATALOGS)) {
      const ids = catalog.tricks.map((t) => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("references only known spot type slugs", () => {
    const known = new Set(SPOT_TYPE_SEED.map((type) => type.slug))
    for (const catalog of Object.values(TRICK_CATALOGS)) {
      for (const trick of catalog.tricks) {
        for (const spotType of trick.compatibleSpotTypes) {
          expect(known.has(spotType)).toBe(true)
        }
      }
    }
  })

  it("exposes a valid catalog per discipline", () => {
    expect(catalogForDiscipline("scooter").tricks.length).toBeGreaterThan(0)
    expect(catalogForDiscipline("roller").tricks.length).toBeGreaterThan(0)
  })

  it("rejects tricks with a mismatched discipline", () => {
    expect(() => validateTrickCatalog("scooter", {
      discipline: "scooter",
      tricks: [{
        id: "test",
        name: "Test",
        description: "Test trick",
        level: 1,
        discipline: "roller",
        compatibleSpotTypes: ["rails"],
      }],
    })).toThrow(/declares discipline roller/)
  })

  it("rejects unknown compatibility slugs", () => {
    expect(() => validateTrickCatalog("roller", {
      discipline: "roller",
      tricks: [{
        id: "test",
        name: "Test",
        description: "Test trick",
        level: 1,
        discipline: "roller",
        compatibleSpotTypes: ["unknown-type"],
      }],
    })).toThrow(/unknown spot type unknown-type/)
  })

  it("accepts levels 1 through 5", () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(() => validateTrickCatalog("roller", {
        discipline: "roller",
        tricks: [{
          id: `test-${level}`,
          name: "Test",
          description: "Test trick",
          level,
          discipline: "roller",
          compatibleSpotTypes: ["rails"],
        }],
      })).not.toThrow()
    }
  })
})
