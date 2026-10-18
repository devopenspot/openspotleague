import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SportEvent } from "@/types/sport-events"

const listShuffledIdsMock = vi.fn()
const listByIdsMock = vi.fn()
const listMock = vi.fn()

vi.mock("@/lib/repositories", () => ({
  getEventRepositoryAsync: async () => ({
    listShuffledIds: listShuffledIdsMock,
    listByIds: listByIdsMock,
    list: listMock,
  }),
}))

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import {
  listEventShuffleIds,
  runListEvents,
  runListEventsRandom,
  toEventShuffleFilters,
} from "./events"

const SEED_A = "11111111-1111-1111-1111-111111111111"
const SEED_B = "22222222-2222-2222-2222-222222222222"

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `event-${i}`)
}

function event(id: string): SportEvent {
  return {
    id,
    slug: `slug-${id}`,
    name: `Event ${id}`,
    url: null,
    image: `https://example.com/${id}.webp`,
    description: "desc",
    sports: [],
    startDate: "2026-11-01",
    location: {
      city: "Bogota",
      country: "Colombia",
      countryCode: "CO",
    },
    category: "festival",
    categoryName: "Festival",
    origin: "seed",
    visibility: "public",
    lifecycleStatus: "scheduled",
    timezone: "UTC",
    spotName: null,
    featured: false,
    instagram: null,
    youtube: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

beforeEach(() => {
  listShuffledIdsMock.mockReset()
  listByIdsMock.mockReset()
  listMock.mockReset()
  listByIdsMock.mockImplementation(async (pageIds: readonly string[]) =>
    [...pageIds].reverse().map(event),
  )
})

describe("toEventShuffleFilters", () => {
  it("strips paging/shuffle keys but keeps filter predicates", () => {
    expect(
      toEventShuffleFilters({
        q: "jam",
        country: "Colombia",
        citySlug: "bogota",
        category: "festival",
        featured: true,
        from: "2026-01-01",
        to: "2026-12-31",
        limit: 12,
        random: true,
        seed: SEED_A,
        cursor: "cursor",
      }),
    ).toEqual({
      q: "jam",
      country: "Colombia",
      citySlug: "bogota",
      category: "festival",
      featured: true,
      from: "2026-01-01",
      to: "2026-12-31",
    })
  })
})

describe("listEventShuffleIds", () => {
  it("delegates to the repository (cached by filter at the Next layer)", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(3))
    const filters = toEventShuffleFilters({})
    await expect(listEventShuffleIds(filters)).resolves.toEqual(ids(3))
    expect(listShuffledIdsMock).toHaveBeenCalledWith(filters)
  })
})

describe("runListEventsRandom", () => {
  it("pages enriched events in seeded order with hasMore flags", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(10))
    const page1 = await runListEventsRandom({ limit: 4, random: true, seed: SEED_A })
    expect(page1.items).toHaveLength(4)
    expect(page1.hasMore).toBe(true)
    expect(page1.nextCursor).not.toBeNull()
    // Enrichment preserved (status + date label drive the wire meta).
    for (const item of page1.items) {
      expect(item.dateRangeLabel.length).toBeGreaterThan(0)
      expect(item.status).toBeDefined()
    }
    // Order restored despite the reversed repo return.
    const requested = listByIdsMock.mock.calls[0]?.[0] as readonly string[]
    expect(page1.items.map((e) => e.id)).toEqual([...requested])

    const seen = [...page1.items.map((e) => e.id)]
    const page2 = await runListEventsRandom({
      limit: 4,
      random: true,
      seed: SEED_A,
      cursor: page1.nextCursor!,
    })
    seen.push(...page2.items.map((e) => e.id))
    expect(page2.hasMore).toBe(true)
    const page3 = await runListEventsRandom({
      limit: 4,
      random: true,
      seed: SEED_A,
      cursor: page2.nextCursor!,
    })
    seen.push(...page3.items.map((e) => e.id))
    expect(page3.hasMore).toBe(false)
    expect(page3.nextCursor).toBeNull()
    expect(seen).toHaveLength(10)
    expect(new Set(seen).size).toBe(10)
  })

  it("restarts at zero for a foreign-seed cursor", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(10))
    const head = await runListEventsRandom({ limit: 4, random: true, seed: SEED_A })
    const other = await runListEventsRandom({ limit: 4, random: true, seed: SEED_B })
    expect(other.nextCursor).not.toBeNull()
    const restarted = await runListEventsRandom({
      limit: 4,
      random: true,
      seed: SEED_A,
      cursor: other.nextCursor!,
    })
    expect(restarted.items.map((e) => e.id)).toEqual(head.items.map((e) => e.id))
  })

  it("returns an empty page when the filter matches nothing", async () => {
    listShuffledIdsMock.mockResolvedValue([])
    await expect(
      runListEventsRandom({ limit: 12, random: true, seed: SEED_A }),
    ).resolves.toEqual({ items: [], nextCursor: null, hasMore: false })
    expect(listByIdsMock).not.toHaveBeenCalled()
  })
})

describe("runListEvents", () => {
  it("routes random+seed through the shuffle path, not repo.list", async () => {
    listShuffledIdsMock.mockResolvedValue(ids(2))
    await runListEvents({ limit: 12, random: true, seed: SEED_A })
    expect(listShuffledIdsMock).toHaveBeenCalled()
    expect(listMock).not.toHaveBeenCalled()
  })

  it("keeps deterministic queries on repo.list", async () => {
    listMock.mockResolvedValue({ items: [event("e1")], nextCursor: null, hasMore: false })
    const result = await runListEvents({ limit: 12 })
    expect(listByIdsMock).not.toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.dateRangeLabel.length).toBeGreaterThan(0)
  })
})
