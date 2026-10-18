import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const listEventsMock = vi.fn()

vi.mock("@/lib/services/event/events", () => ({
  listEvents: (...args: unknown[]) => listEventsMock(...args),
  findFeaturedEvent: vi.fn(),
  findEventById: vi.fn(),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/events${query}`)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/events", () => {
  it("returns 200 with items from the service", async () => {
    listEventsMock.mockResolvedValue({
      items: [{ id: "e1" }, { id: "e2" }],
      nextCursor: "next",
      hasMore: true,
    })
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: unknown[]
      nextCursor: string | null
      hasMore: boolean
    }
    expect(body).toEqual({
      items: [{ id: "e1" }, { id: "e2" }],
      nextCursor: "next",
      hasMore: true,
    })
  })

  it("coerces the limit query param from a string into a number", async () => {
    listEventsMock.mockResolvedValue([])
    await GET(makeRequest("?limit=10"))
    const call = listEventsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ limit: 10 })
  })

  it("forwards an opaque cursor to the service", async () => {
    listEventsMock.mockResolvedValue([])
    await GET(makeRequest("?cursor=eyJ2IjoxLCJpZCI6ImUxIn0"))
    const call = listEventsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ cursor: "eyJ2IjoxLCJpZCI6ImUxIn0" })
  })

  it("forwards the citySlug query to the service", async () => {
    listEventsMock.mockResolvedValue([])
    await GET(makeRequest("?citySlug=los-angeles-united-states"))
    const call = listEventsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ citySlug: "los-angeles-united-states" })
  })

  it("returns 200 with only events matching the requested citySlug (U1)", async () => {
    const target = "los-angeles-united-states"
    const matching = [
      { id: "e1", name: "SLS LA", citySlug: target },
      { id: "e2", name: "X Games LA", citySlug: target },
    ]
    listEventsMock.mockResolvedValue({ items: matching, nextCursor: null, hasMore: false })
    const res = await GET(makeRequest(`?citySlug=${target}`))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: Array<{ citySlug: string }> }
    expect(body.items).toHaveLength(2)
    for (const item of body.items) {
      expect(item.citySlug).toBe(target)
    }
  })

  it("returns 200 with the same shape for an empty query (regression)", async () => {
    const expected = [
      { id: "e1", name: "SLS" },
      { id: "e2", name: "FISE" },
    ]
    listEventsMock.mockResolvedValue({ items: expected, nextCursor: null, hasMore: false })
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: unknown[]; nextCursor: string | null; hasMore: boolean }
    expect(body).toEqual({ items: expected, nextCursor: null, hasMore: false })
  })

  it("coerces the featured query param into a boolean", async () => {
    listEventsMock.mockResolvedValue([])
    await GET(makeRequest("?featured=true"))
    const call = listEventsMock.mock.calls[0] as [unknown] | undefined
    expect(call?.[0]).toMatchObject({ featured: true })
  })

  it("rejects malformed boolean filters", async () => {
    const res = await GET(makeRequest("?featured=maybe"))
    expect(res.status).toBe(400)
    expect(listEventsMock).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid category", async () => {
    const res = await GET(makeRequest("?category=invalid"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when the limit exceeds the public cap", async () => {
    const res = await GET(makeRequest("?limit=201"))
    expect(res.status).toBe(400)
  })

  it("returns 400 on unknown query keys (strict schema)", async () => {
    const res = await GET(makeRequest("?garbage=x"))
    expect(res.status).toBe(400)
  })

  it("projects events to MarqueeEventInput fields when random=true", async () => {
    listEventsMock.mockResolvedValue({
      items: [
        {
          id: "e1",
          name: "SLS",
          image: "https://example.test/sls.webp",
          slug: "sls",
          dateRangeLabel: "Jun 1",
          sports: ["Skateboard"],
          description: "should be stripped",
          address: "LA",
        },
      ],
      nextCursor: "next",
      hasMore: true,
    })
    const res = await GET(
      makeRequest("?random=true&seed=00000000-0000-4000-8000-000000000001"),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>
      nextCursor: string | null
      hasMore: boolean
    }
    expect(body.items).toEqual([
      {
        id: "e1",
        name: "SLS",
        image: "https://example.test/sls.webp",
        slug: "sls",
        dateRangeLabel: "Jun 1",
        sports: ["Skateboard"],
      },
    ])
  })

  it("returns 500 when the service throws", async () => {
    listEventsMock.mockRejectedValue(new Error("db down"))
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(500)
  })
})
