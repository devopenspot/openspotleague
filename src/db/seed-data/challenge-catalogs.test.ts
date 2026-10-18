import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ensureCurrentTrickCatalogSnapshot,
  replaceCanonicalTricks,
} from "@/lib/repositories/taxonomy/trick-catalog-store"
import {
  canonicalCatalogSha256,
  loadCatalog,
  parseDisciplineSlug,
  seedChallengeCatalogForDiscipline,
  seedChallengeCatalogs,
} from "@/db/seed-data/challenge-catalogs"
import { SPOT_TYPE_SEED } from "@/db/seed-data/taxonomy"

vi.mock("@/lib/repositories/taxonomy/trick-catalog-store", () => ({
  replaceCanonicalTricks: vi.fn(),
  ensureCurrentTrickCatalogSnapshot: vi.fn(),
}))

const replaceMock = vi.mocked(replaceCanonicalTricks)
const snapshotMock = vi.mocked(ensureCurrentTrickCatalogSnapshot)

function stubDb() {
  return {
    transaction: (fn: (tx: unknown) => unknown) => Promise.resolve(fn({})),
  }
}

type SeedDb = Parameters<typeof seedChallengeCatalogForDiscipline>[0]

describe("challenge catalog import identity", () => {
  const catalog = {
    version: "source-v1",
    discipline: "bmx",
    tricks: [{
      id: "360",
      name: "360",
      description: "A full rotation.",
      level: 1,
      discipline: "bmx",
       compatibleSpotTypes: ["bowl", "rails"],
    }],
  }

  it("ignores the non-normative source version", () => {
    expect(canonicalCatalogSha256(catalog)).toBe(
      canonicalCatalogSha256({ ...catalog, version: "source-v2" }),
    )
  })

  it("changes identity when trick content changes", () => {
    expect(canonicalCatalogSha256(catalog)).not.toBe(
      canonicalCatalogSha256({
        ...catalog,
        tricks: [{ ...catalog.tricks[0], description: "A changed rotation." }],
      }),
    )
  })

  it("ignores compatibility ordering when calculating identity", () => {
    expect(canonicalCatalogSha256(catalog)).toBe(
      canonicalCatalogSha256({
        ...catalog,
        tricks: [{ ...catalog.tricks[0], compatibleSpotTypes: ["rails", "bowl"] }],
      }),
    )
  })
})

describe("loadCatalog fixtures", () => {
  it.each(["skateboard", "bmx", "scooter", "roller"] as const)(
    "loads the %s fixture with a matching discipline and unique trick ids",
    (discipline) => {
      const catalog = loadCatalog(discipline)
      expect(catalog.discipline).toBe(discipline)
      expect(catalog.tricks.length).toBeGreaterThan(0)
    },
  )

  it.each(["skateboard", "bmx", "scooter", "roller"] as const)(
    "references only known spot_types in the %s fixture",
    (discipline) => {
      const known = new Set(SPOT_TYPE_SEED.map((entry) => entry.slug))
      const unknown = [
        ...new Set(
          loadCatalog(discipline).tricks.flatMap(
            (trick) => trick.compatibleSpotTypes,
          ),
        ),
      ].filter((slug) => !known.has(slug.trim().toLowerCase()))
      expect(unknown).toEqual([])
    },
  )
})

describe("parseDisciplineSlug", () => {
  it("accepts the four discipline slugs, ignoring case and padding", () => {
    expect(parseDisciplineSlug("skateboard")).toBe("skateboard")
    expect(parseDisciplineSlug("  BMX ")).toBe("bmx")
    expect(parseDisciplineSlug("Scooter")).toBe("scooter")
    expect(parseDisciplineSlug("roller")).toBe("roller")
  })

  it("rejects missing, empty, and unknown disciplines", () => {
    expect(parseDisciplineSlug(undefined)).toBeNull()
    expect(parseDisciplineSlug("")).toBeNull()
    expect(parseDisciplineSlug("surf")).toBeNull()
  })
})

describe("seedChallengeCatalogForDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    snapshotMock.mockResolvedValue("catalog-123")
  })

  it("replaces and snapshots only the requested discipline", async () => {
    const db = stubDb() as unknown as SeedDb
    const result = await seedChallengeCatalogForDiscipline(db, "roller")

    expect(result).toEqual({
      catalogId: "catalog-123",
      trickCount: loadCatalog("roller").tricks.length,
    })
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith(
      db,
      "roller",
      expect.arrayContaining([
        expect.objectContaining({ sourceId: expect.any(String) }),
      ]),
    )
    const input = replaceMock.mock.calls[0]?.[2] ?? []
    expect(input).toHaveLength(loadCatalog("roller").tricks.length)
    expect(snapshotMock).toHaveBeenCalledTimes(1)
    expect(snapshotMock).toHaveBeenCalledWith({}, "roller")
  })

  it("fans the full seed out to all four disciplines", async () => {
    const db = stubDb() as unknown as SeedDb
    await seedChallengeCatalogs(db)

    expect(replaceMock).toHaveBeenCalledTimes(4)
    expect(replaceMock.mock.calls.map((call) => call[1]).sort()).toEqual([
      "bmx",
      "roller",
      "scooter",
      "skateboard",
    ])
    expect(snapshotMock).toHaveBeenCalledTimes(4)
  })
})
