import { describe, it, expect, vi, beforeEach } from "vitest"

const findFeaturedEventMock = vi.fn()

vi.mock("@/lib/services/event/events", () => ({
  findFeaturedEvent: (...args: unknown[]) => findFeaturedEventMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

const sampleEvent = {
  id: "event-1",
  slug: "fise-2025",
  name: "FISE 2025",
  url: "https://example.com",
  image: "https://example.com/img.png",
  description: "Festival",
  sports: ["Skateboard"],
  startDate: "2025-07-01",
  endDate: "2025-07-05",
  location: { city: "Montpellier", country: "France" },
  category: "festival" as const,
  categoryName: "Festival",
  featured: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  status: "upcoming" as const,
  dateRangeLabel: "JUL 1–5, 2025",
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/events/featured", () => {
  it("returns 200 with the featured event", async () => {
    findFeaturedEventMock.mockResolvedValue(sampleEvent)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleEvent)
  })

  it("returns 404 when no event is featured", async () => {
    findFeaturedEventMock.mockResolvedValue(undefined)
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it("returns 500 when the service throws", async () => {
    findFeaturedEventMock.mockRejectedValue(new Error("db down"))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
