import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Spot } from "@/lib/types"
import type { SpotCard } from "@/lib/repositories/core/types"

const listShuffledIdsMock = vi.fn()
const listCardsByIdsMock = vi.fn()
const listMock = vi.fn()

vi.mock("@/lib/repositories", () => ({
  getSpotRepositoryAsync: async () => ({
    listShuffledIds: listShuffledIdsMock,
    listCardsByIds: listCardsByIdsMock,
    list: listMock,
  }),
}))

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/storage", () => ({
  getSpotDetailImageUrlsCached: async (paths: readonly string[]) =>
    new Map(paths.map((p) => [p, `resolved:${p}`])),
}))

vi.mock("@/lib/storage/variants", () => ({
  extractStoragePath: (url: string | null) => (url ? url : null),
}))

import {
  listSpotShuffleIds,
  runListSpotCards,
  toSpotCard,
  toSpotShuffleFilters,
} from "./spots"

const SEED_A = "11111111-1111-1111-1111-111111111111"
const SEED_B = "22222222-2222-2222-2222-222222222222"

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `spot-${i}`)
}

function card(id: string): SpotCard {
  return { id, name: `Spot ${id}`, city: "Bogota", image: `raw:${id}`, sports: [] }
}

function spot(id: string): Spot {
  return {
    id,
    slug: `slug-${id}`,
    name: `Spot ${id}`,
    city: "Bogota",
    citySlug: "bogota",
    address: "calle 1",
    types: [],
    sports: [],
    image: `raw:${id}`,
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 0,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat: 4.6, lon: -74.06 },
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

beforeEach(() => {
  listShuffledIdsMock.mockReset()
  listCardsByIdsMock.mockReset()
  listMock.mockReset()
  // Default: repo returns cards reversed so tests prove the service
  // restores shuffle order.
  listCardsByIdsMock.mockImplementation(async (pageIds: readonly string[]) =>
    [...pageIds].reverse().map(card),
  )
})

describe("toSpotShuffleFilters", () => {
  it("strips paging/shuffle keys but keeps filter predicates", () => {
    expect(
      toSpotShuffleFilters({
        q: "park",
        types: ["plaza"],
        country: "Colombia",
        countryCode: "CO",
        discipline: "Skateboard",
        city: "bogota",
        ids: ["a"],
        scope: "public",
        visibility: "public",
        origin: "seed",
        adminHidden: false,
        includeHidden: false,
        limit: 12,
        random: true,
        seed: SEED_A,
        cursor: "cursor",
        near: { lat: 4.6, lon: -74.06, radiusMeters: 1000 },
      }),
    ).toEqual({
      q: "park",
      types: ["plaza"],
      country: "Colombia",
      countryCode: "CO",
      discipline: "Skateboard",
      city: "bogota",
      ids: ["a"],
      scope: "public",
      visibility: "public",
      origin: "seed",
      adminHidden: false,
      includeHidden: false,
    })
  })
})

describe("listSpotShuffleIds", () => {
  it("delegates to the repository (cached by filter at the Next layer)", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(3))
    const filters = toSpotShuffleFilters({ hasImage: true })
    await expect(listSpotShuffleIds(filters)).resolves.toEqual(ids(3))
    expect(listShuffledIdsMock).toHaveBeenCalledWith(filters)
  })
})

describe("runListSpotCards", () => {
  it("is deterministic per seed and resolves image variants in page order", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(10))
    const first = await runListSpotCards({ limit: 4, random: true, seed: SEED_A, hasImage: true })
    const second = await runListSpotCards({ limit: 4, random: true, seed: SEED_A, hasImage: true })
    expect(first.items.map((c) => c.id)).toEqual(second.items.map((c) => c.id))
    expect(first.items).toHaveLength(4)
    expect(first.nextCursor).not.toBeNull()
    // Variant resolution applied to every card.
    for (const item of first.items) {
      expect(item.image.startsWith("resolved:raw:")).toBe(true)
    }
    // Shuffle order restored despite the reversed repo return: items
    // follow the page-ID order the service requested, not repo order.
    const requested = listCardsByIdsMock.mock.calls[0]?.[0] as readonly string[]
    expect(first.items.map((c) => c.id)).toEqual([...requested])
  })

  it("paginates without overlap until the cursor is exhausted", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(10))
    const seen: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 5; page++) {
      const result = await runListSpotCards({ limit: 4, random: true, seed: SEED_A, cursor })
      seen.push(...result.items.map((c) => c.id))
      if (!result.nextCursor) break
      cursor = result.nextCursor
    }
    expect(seen).toHaveLength(10)
    expect(new Set(seen).size).toBe(10)
  })

  it("restarts at zero for a foreign-seed or corrupt cursor", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(10))
    const head = await runListSpotCards({ limit: 4, random: true, seed: SEED_A })
    const other = await runListSpotCards({ limit: 4, random: true, seed: SEED_B })
    expect(other.nextCursor).not.toBeNull()
    const restarted = await runListSpotCards({
      limit: 4,
      random: true,
      seed: SEED_A,
      cursor: other.nextCursor!,
    })
    expect(restarted.items.map((c) => c.id)).toEqual(head.items.map((c) => c.id))
    const corrupt = await runListSpotCards({
      limit: 4,
      random: true,
      seed: SEED_A,
      cursor: "not-a-cursor",
    })
    expect(corrupt.items.map((c) => c.id)).toEqual(head.items.map((c) => c.id))
  })

  it("returns an empty page when the filter matches nothing", async () => {
    listShuffledIdsMock.mockResolvedValue([])
    await expect(
      runListSpotCards({ limit: 12, random: true, seed: SEED_A }),
    ).resolves.toEqual({ items: [], nextCursor: null })
    expect(listCardsByIdsMock).not.toHaveBeenCalled()
  })

  it("falls back to the deterministic list (projected to cards) without a seed", async () => {
    listMock.mockResolvedValue({ items: [spot("x")], nextCursor: "cursor-1" })
    const result = await runListSpotCards({ limit: 12, random: true })
    expect(listShuffledIdsMock).not.toHaveBeenCalled()
    expect(listMock).toHaveBeenCalledWith({ limit: 12, random: false, seed: undefined })
    expect(result).toEqual({
      items: [toSpotCard(spot("x"))],
      nextCursor: "cursor-1",
    })
  })

  it("keeps the raw image when no storage path resolves", async () => {
    listShuffledIdsMock.mockResolvedValue(["s1"])
    listCardsByIdsMock.mockResolvedValue([{ ...card("s1"), image: "" }])
    const result = await runListSpotCards({ limit: 12, random: true, seed: SEED_A })
    expect(result.items[0]?.image).toBe("")
  })
})
