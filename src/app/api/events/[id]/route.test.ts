import { describe, it, expect, vi, beforeEach } from "vitest"

const findEventByIdMock = vi.fn()

vi.mock("@/lib/services/event/events", () => ({
  findEventById: (...args: unknown[]) => findEventByIdMock(...args),
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

const fakeContext = (id: string) => ({
  params: Promise.resolve({ id }),
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/events/[id]", () => {
  it("returns 200 with the event when found", async () => {
    findEventByIdMock.mockResolvedValue(sampleEvent)
    const res = await GET(
      { url: "http://localhost/api/events/event-1" } as never,
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleEvent)
    expect(findEventByIdMock).toHaveBeenCalledWith("event-1")
  })

  it("returns 404 when the event is not found", async () => {
    findEventByIdMock.mockResolvedValue(null)
    const res = await GET(
      { url: "http://localhost/api/events/missing" } as never,
      fakeContext("missing") as never,
    )
    expect(res.status).toBe(404)
  })

  it("returns 500 when the service throws", async () => {
    findEventByIdMock.mockRejectedValue(new Error("db down"))
    const res = await GET(
      { url: "http://localhost/api/events/event-1" } as never,
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(500)
  })
})
