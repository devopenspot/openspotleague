import { describe, expect, it } from "vitest"
import type { drizzle } from "drizzle-orm/postgres-js"
import type { TvVideoRow } from "@/db/schema"
import { DrizzleTvRepository } from "./drizzle-tv-repository"

function makeRow(overrides: Partial<TvVideoRow> = {}): TvVideoRow {
  return {
    id: "tv-1",
    title: "Fifty Classic Clips",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    disciplineSlug: "skateboard",
    categories: ["historic", "profile"],
    postDate: new Date("2026-01-15T00:00:00Z"),
    published: true,
    sortOrder: 3,
    createdBy: "admin-1",
    updatedBy: "admin-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  } as TvVideoRow
}

type Chain = {
  where: () => Chain
  orderBy: () => Chain
  groupBy: () => Chain
  limit: (n: number) => Promise<TvVideoRow[]>
  $dynamic: () => Chain
  then: (resolve: (rows: TvVideoRow[]) => unknown) => Promise<unknown>
}

function makeDb(
  rows: TvVideoRow[],
  capture?: { limit?: number[] },
  executeRows?: unknown[],
) {
  const chain: Chain = {
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    limit: (n: number) => {
      capture?.limit?.push(n)
      return Promise.resolve(rows)
    },
    $dynamic: () => chain,
    // Count queries terminate without .limit() — resolve the rows on await.
    then: (resolve) => Promise.resolve(rows).then(resolve),
  }
  return {
    select: () => ({ from: () => chain }),
    execute: () => Promise.resolve(executeRows ?? []),
  } as unknown as ReturnType<typeof drizzle>
}

describe("DrizzleTvRepository read paths", () => {
  it("maps rows to domain objects with embed URLs and ISO dates", async () => {
    const repository = new DrizzleTvRepository(makeDb([makeRow()]))
    const video = await repository.findById("tv-1")
    expect(video).toMatchObject({
      id: "tv-1",
      embedUrl:
        "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1&playsinline=1&rel=0",
      disciplineSlug: "skateboard",
      categories: ["historic", "profile"],
      published: true,
      sortOrder: 3,
      postDate: "2026-01-15T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    })
  })

  it("falls back to the raw URL when parsing fails", async () => {
    const repository = new DrizzleTvRepository(
      makeDb([makeRow({ youtubeUrl: "not-a-youtube-url" })]),
    )
    const video = await repository.findById("tv-1")
    expect(video?.embedUrl).toBe("not-a-youtube-url")
  })

  it("returns null when findById misses", async () => {
    const repository = new DrizzleTvRepository(makeDb([]))
    await expect(repository.findById("missing")).resolves.toBeNull()
  })

  it("clamps the list limit into the 1..500 window (default 500)", async () => {
    const capture: { limit: number[] } = { limit: [] }
    const repository = new DrizzleTvRepository(makeDb([], capture))
    await repository.list()
    await repository.list({ limit: 0 })
    await repository.list({ limit: 5_000 })
    await repository.list({ limit: 25 })
    expect(capture.limit).toEqual([500, 1, 500, 25])
  })

  it("lowercases the discipline filter and maps listed rows", async () => {
    const rows = [makeRow(), makeRow({ id: "tv-2" })]
    const repository = new DrizzleTvRepository(makeDb(rows))
    const videos = await repository.list({
      publishedOnly: true,
      disciplineSlug: "SKATEBOARD",
      category: "historic",
    })
    expect(videos.map((v) => v.id)).toEqual(["tv-1", "tv-2"])
  })
})

describe("DrizzleTvRepository card paths", () => {
  it("projects only card columns (no audit/moderation fields)", async () => {
    const repository = new DrizzleTvRepository(makeDb([makeRow()]))
    const [card] = await repository.listCards({ publishedOnly: true })
    expect(card).toEqual({
      id: "tv-1",
      title: "Fifty Classic Clips",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl:
        "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1&playsinline=1&rel=0",
      disciplineSlug: "skateboard",
      categories: ["historic", "profile"],
      postDate: "2026-01-15T00:00:00.000Z",
    })
  })

  it("clamps the card limit into the 1..500 window (default 500)", async () => {
    const capture: { limit: number[] } = { limit: [] }
    const repository = new DrizzleTvRepository(makeDb([], capture))
    await repository.listCards()
    await repository.listCards({ limit: 0 })
    await repository.listCards({ limit: 25 })
    expect(capture.limit).toEqual([500, 1, 25])
  })

  it("returns the public card for a published id", async () => {
    const repository = new DrizzleTvRepository(makeDb([makeRow()]))
    const card = await repository.findCardById("tv-1")
    expect(card?.id).toBe("tv-1")
    expect(card).not.toHaveProperty("createdBy")
  })

  it("returns null when findCardById misses", async () => {
    const repository = new DrizzleTvRepository(makeDb([]))
    await expect(repository.findCardById("missing")).resolves.toBeNull()
  })

  it("pages cards with a signed cursor and limit+1 lookahead", async () => {
    const rows = [makeRow(), makeRow({ id: "tv-2" }), makeRow({ id: "tv-3" })]
    const repository = new DrizzleTvRepository(makeDb(rows))
    const page = await repository.listCardPage({ publishedOnly: true, limit: 2 })
    expect(page.items.map((v) => v.id)).toEqual(["tv-1", "tv-2"])
    expect(page.nextCursor).not.toBeNull()
  })

  it("ends the page (null cursor) when rows fit the limit", async () => {
    const repository = new DrizzleTvRepository(makeDb([makeRow()]))
    const page = await repository.listCardPage({ limit: 12 })
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
  })

  it("restarts at the first page for a corrupt cursor", async () => {
    const rows = [makeRow(), makeRow({ id: "tv-2" })]
    const repository = new DrizzleTvRepository(makeDb(rows))
    const page = await repository.listCardPage({ limit: 1, cursor: "corrupt" })
    expect(page.items.map((v) => v.id)).toEqual(["tv-1"])
    expect(page.nextCursor).not.toBeNull()
  })

  it("returns ordered ids for the queue snapshot", async () => {
    const rows = [makeRow(), makeRow({ id: "tv-2" })]
    const repository = new DrizzleTvRepository(makeDb(rows))
    await expect(
      repository.listTvIdList({ publishedOnly: true }),
    ).resolves.toEqual(["tv-1", "tv-2"])
  })

  it("batch-finds cards preserving request order (deduped, capped)", async () => {
    // DB row order is arbitrary — request order wins.
    const rows = [makeRow({ id: "tv-2" }), makeRow()]
    const repository = new DrizzleTvRepository(makeDb(rows))
    const cards = await repository.findCardsByIds(["tv-1", "tv-2", "tv-1"])
    expect(cards.map((c) => c.id)).toEqual(["tv-1", "tv-2"])
    expect(cards[0]).not.toHaveProperty("createdBy")
  })

  it("caps the batch window at TV_CARD_BATCH_MAX ids", async () => {
    const capture: { limit: number[] } = { limit: [] }
    const ids = Array.from({ length: 15 }, (_, i) => `tv-${i + 1}`)
    const rows = ids.map((id) => makeRow({ id }))
    const repository = new DrizzleTvRepository(makeDb(rows, capture))
    const cards = await repository.findCardsByIds(ids)
    expect(capture.limit).toEqual([10])
    expect(cards).toHaveLength(10)
  })

  it("returns an empty batch without querying for no ids", async () => {
    const repository = new DrizzleTvRepository(makeDb([]))
    await expect(repository.findCardsByIds([])).resolves.toEqual([])
  })

  it("counts by category and discipline", async () => {
    const repository = new DrizzleTvRepository(
      makeDb([
        { category: "music", count: 3 },
        { category: "trick", count: 1 },
      ] as unknown as TvVideoRow[]),
    )
    await expect(repository.countByCategory()).resolves.toEqual([
      { category: "music", count: 3 },
      { category: "trick", count: 1 },
    ])
    const byDiscipline = new DrizzleTvRepository(
      makeDb([{ disciplineSlug: "roller", count: 2 }] as unknown as TvVideoRow[]),
    )
    await expect(byDiscipline.countByDiscipline()).resolves.toEqual([
      { disciplineSlug: "roller", count: 2 },
    ])
  })
})

describe("DrizzleTvRepository listCategoryRows", () => {
  it("groups windowed rows into canonical category rows with shared card references and cursors", async () => {
    const rawRows = [
      {
        id: "tv-1",
        title: "Classic 1",
        youtube_url: "https://www.youtube.com/watch?v=video1",
        discipline_slug: "skateboard",
        categories: ["profile", "historic"],
        post_date: "2026-02-01T00:00:00.000Z",
        sort_order: 1,
        created_at: "2026-02-01T00:00:00.000Z",
        category: "historic",
        total: 2,
        rn: 1,
      },
      {
        id: "tv-2",
        title: "Classic 2",
        youtube_url: "https://www.youtube.com/watch?v=video2",
        discipline_slug: "skateboard",
        categories: ["historic"],
        post_date: "2026-01-20T00:00:00.000Z",
        sort_order: 2,
        created_at: "2026-01-20T00:00:00.000Z",
        category: "historic",
        total: 2,
        rn: 2,
      },
      {
        id: "tv-1",
        title: "Classic 1",
        youtube_url: "https://www.youtube.com/watch?v=video1",
        discipline_slug: "skateboard",
        categories: ["profile", "historic"],
        post_date: "2026-02-01T00:00:00.000Z",
        sort_order: 1,
        created_at: "2026-02-01T00:00:00.000Z",
        category: "profile",
        total: 1,
        rn: 1,
      },
    ]

    const repository = new DrizzleTvRepository(
      makeDb([], undefined, rawRows),
    )

    // With limit = 1, "historic" has total 2, so rn 2 acts as the lookahead row for nextCursor
    const result = await repository.listCategoryRows({ limit: 1 })

    // Categories follow canonical order
    const historicRow = result.find((r) => r.category === "historic")
    const profileRow = result.find((r) => r.category === "profile")

    expect(historicRow).toBeDefined()
    expect(historicRow?.total).toBe(2)
    expect(historicRow?.videos).toHaveLength(1)
    expect(historicRow?.videos[0]?.id).toBe("tv-1")
    expect(historicRow?.nextCursor).not.toBeNull()

    expect(profileRow).toBeDefined()
    expect(profileRow?.total).toBe(1)
    expect(profileRow?.videos).toHaveLength(1)
    expect(profileRow?.videos[0]?.id).toBe("tv-1")
    expect(profileRow?.nextCursor).toBeNull()

    // Deduplication check: tv-1 in historic and profile should reference the exact same card instance
    expect(historicRow?.videos[0]).toBe(profileRow?.videos[0])
  })
})

