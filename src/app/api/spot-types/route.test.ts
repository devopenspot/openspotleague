import { describe, it, expect, vi, beforeEach } from "vitest"

const listSpotTypesMock = vi.fn()

vi.mock("@/lib/services/spot/spot-types", () => ({
  listSpotTypes: (...args: unknown[]) => listSpotTypesMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

const sample = [
  { slug: "plaza", name: "Plaza" },
  { slug: "skatepark", name: "Skatepark" },
]

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/spot-types", () => {
  it("returns 200 with the items", async () => {
    listSpotTypesMock.mockResolvedValue(sample)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: sample })
  })

  it("returns 200 with empty items", async () => {
    listSpotTypesMock.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [] })
  })

  it("returns 500 when the service throws", async () => {
    listSpotTypesMock.mockRejectedValue(new Error("db down"))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
