import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const listCountriesMock = vi.fn()

vi.mock("@/lib/services/spot/countries", () => ({
  listCountries: (...args: unknown[]) => listCountriesMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

const sample = [
  { iso2: "FR", name: "France", region: "Europe" },
  { iso2: "US", name: "United States", region: "Americas" },
]

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/countries${query}`)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/countries", () => {
  it("returns 200 with the items when no query is provided", async () => {
    listCountriesMock.mockResolvedValue({
      items: sample,
      countryIso2ByName: { France: "FR", "United States": "US" },
    })
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: sample })
    expect(listCountriesMock).toHaveBeenCalledWith("")
  })

  it("forwards the ?q= query to the service unchanged", async () => {
    listCountriesMock.mockResolvedValue({
      items: [sample[0]!],
      countryIso2ByName: { France: "FR" },
    })
    const res = await GET(makeRequest("?q=fran"))
    expect(res.status).toBe(200)
    expect(listCountriesMock).toHaveBeenCalledWith("fran")
    expect(await res.json()).toEqual({ items: [sample[0]] })
  })

  it("returns 200 with empty items", async () => {
    listCountriesMock.mockResolvedValue({
      items: [],
      countryIso2ByName: {},
    })
    const res = await GET(makeRequest("?q=zzz"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [] })
  })

  it("returns 400 when the query exceeds 64 chars", async () => {
    const long = "a".repeat(65)
    const res = await GET(makeRequest(`?q=${long}`))
    expect(res.status).toBe(400)
    expect(listCountriesMock).not.toHaveBeenCalled()
  })

  it("returns 500 when the service throws", async () => {
    listCountriesMock.mockRejectedValue(new Error("db down"))
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(500)
  })
})
