import { describe, it, expect, vi, beforeEach } from "vitest"

const listRegionsMock = vi.fn()

vi.mock("@/lib/services/spot/regions", () => ({
  listRegions: (...args: unknown[]) => listRegionsMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

const sample = [
  {
    name: "Europe",
    desc: "European spots",
    image: "",
    link: "/map?region=europe",
    count: "100 Spots",
    countries: ["France", "Spain"],
  },
]

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/regions", () => {
  it("returns 200 with the items", async () => {
    listRegionsMock.mockResolvedValue(sample)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: sample })
  })

  it("returns 200 with empty items", async () => {
    listRegionsMock.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [] })
  })

  it("returns 500 when the service throws", async () => {
    listRegionsMock.mockRejectedValue(new Error("db down"))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
