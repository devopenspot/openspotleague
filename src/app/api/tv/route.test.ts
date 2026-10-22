import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const listTvCardPageMock = vi.fn()
const findTvCardByIdMock = vi.fn()
const findTvCardsByIdsMock = vi.fn()
const listTvCategoryRowsMock = vi.fn()

vi.mock("@/lib/services/tv/tv", () => ({
  listTvCardPage: (...args: unknown[]) => listTvCardPageMock(...args),
  findTvCardById: (...args: unknown[]) => findTvCardByIdMock(...args),
  findTvCardsByIds: (...args: unknown[]) => findTvCardsByIdsMock(...args),
  listTvCategoryRows: (...args: unknown[]) => listTvCategoryRowsMock(...args),
}))

import { GET } from "./route"

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/tv${query}`)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/tv", () => {
  it("rejects the plain full-catalog query with a usage hint", async () => {
    const res = await GET(makeRequest("?discipline=Skateboard"))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "Missing query — use ?id= or ?limit=&cursor=",
    })
  })

  it("returns a single card for ?id= and 404 on miss", async () => {
    const validId = "11111111-1111-4111-8111-111111111111"
    const missingId = "00000000-0000-4000-8000-000000000000"
    findTvCardByIdMock.mockResolvedValue({ id: validId })
    const hit = await GET(makeRequest(`?id=${validId}`))
    expect(hit.status).toBe(200)
    expect(await hit.json()).toEqual({ id: validId })
    expect(findTvCardByIdMock).toHaveBeenCalledWith(validId)

    findTvCardByIdMock.mockResolvedValue(null)
    const miss = await GET(makeRequest(`?id=${missingId}`))
    expect(miss.status).toBe(404)

    const invalid = await GET(makeRequest("?id=not-a-uuid"))
    expect(invalid.status).toBe(400)
  })

  it("returns a card page for ?limit= with clamped limit and cursor", async () => {
    const page = { items: [{ id: "v1" }], nextCursor: "cursor-1" }
    listTvCardPageMock.mockResolvedValue(page)
    const res = await GET(makeRequest("?limit=5000&cursor=abc&category=music"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(page)
    expect(listTvCardPageMock).toHaveBeenCalledWith({
      disciplineSlug: undefined,
      category: "music",
      publishedOnly: true,
      limit: 50,
      cursor: "abc",
    })
  })

  it("ignores public ?publishedOnly=false — always published only", async () => {
    const page = { items: [], nextCursor: null }
    listTvCardPageMock.mockResolvedValue(page)
    const res = await GET(makeRequest("?limit=12&publishedOnly=false"))
    expect(res.status).toBe(200)
    expect(listTvCardPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ publishedOnly: true }),
    )
  })

  describe("?ids= batch branch", () => {
    const uuid1 = "11111111-1111-4111-8111-111111111111"
    const uuid2 = "22222222-2222-4222-8222-222222222222"

    it("returns one {cards} payload for a validated window", async () => {
      const cards = [{ id: uuid1 }, { id: uuid2 }]
      findTvCardsByIdsMock.mockResolvedValue(cards)
      const res = await GET(
        makeRequest(`?ids=${uuid1},${uuid1},${uuid2}`),
      )
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ cards })
      // Duplicates collapse before the query.
      expect(findTvCardsByIdsMock).toHaveBeenCalledWith([uuid1, uuid2])
    })

    it("rejects windows beyond the cap", async () => {
      const ids = Array.from(
        { length: 11 },
        (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`,
      )
      const res = await GET(makeRequest(`?ids=${ids.join(",")}`))
      expect(res.status).toBe(400)
    })

    it("rejects non-uuid ids with 400 (no DB cast errors)", async () => {
      const res = await GET(makeRequest("?ids=tv-1"))
      expect(res.status).toBe(400)
    })

    it("rejects an empty window with 400", async () => {
      const res = await GET(makeRequest("?ids=,"))
      expect(res.status).toBe(400)
    })
  })

  describe("?rows=true batch branch", () => {
    it("returns category rows for client-side discipline hydration", async () => {
      const rows = [
        {
          category: "street",
          videos: [{ id: "v1" }],
          nextCursor: null,
          total: 1,
        },
      ]
      listTvCategoryRowsMock.mockResolvedValue(rows)
      const res = await GET(makeRequest("?rows=true&discipline=bmx"))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ rows })
      expect(listTvCategoryRowsMock).toHaveBeenCalledWith("bmx")
    })
  })
})
