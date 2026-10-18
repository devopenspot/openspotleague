import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import type { NominatimResponse } from "@/lib/geocode/project"

const requireAdminMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
    headers: { "Content-Type": "application/json" },
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: () => requireAdminMock(),
  authorizationErrorResponse,
}))

import { GET } from "./route"

const fetchMock = vi.fn()

const sampleNominatim: NominatimResponse = {
  place_id: 12345,
  licence: "Data \u00a9 OpenStreetMap contributors",
  osm_type: "way",
  osm_id: 67890,
  lat: "45.76864173087472",
  lon: "4.836915452991425",
  display_name: "Some Place, Lyon, France",
  type: "leisure",
  class: "leisure",
  importance: 0.5,
  address: {
    house_number: "10",
    road: "Rue de la R\u00e9publique",
    city: "Lyon",
    state: "Auvergne-Rh\u00f4ne-Alpes",
    country: "France",
    country_code: "fr",
    postcode: "69001",
  },
  boundingbox: ["45.768", "45.769", "4.836", "4.837"],
}

function makeRequest(query: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/geocode/reverse${query}`,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("GET /api/geocode/reverse", () => {
  it("returns 401 when not signed in", async () => {
    requireAdminMock.mockRejectedValue(new Error("Not signed in"))
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe("Not signed in")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 403 for non-admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("Admin only"))
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe("Admin only")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 400 for non-numeric lat", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    const res = await GET(makeRequest("?lat=abc&lon=4.8"))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 400 for out-of-range latitude", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    const res = await GET(makeRequest("?lat=99&lon=4.8"))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 400 for out-of-range longitude", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    const res = await GET(makeRequest("?lat=45.7&lon=200"))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 400 when lat or lon is missing", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    const res = await GET(makeRequest("?lat=45.7"))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 200 with a projected address for valid coords", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleNominatim),
    })
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { address: Record<string, unknown> }
    expect(body.address).toEqual({
      displayName: "Some Place, Lyon, France",
      name: null,
      road: "Rue de la R\u00e9publique",
      houseNumber: "10",
      city: "Lyon",
      suburb: null,
      state: "Auvergne-Rh\u00f4ne-Alpes",
      country: "France",
      countryCode: "FR",
      lat: 45.76864173087472,
      lon: 4.836915452991425,
    })
  })

  it("forwards lat/lon, the User-Agent, and cache=no-store to Nominatim", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleNominatim),
    })
    await GET(makeRequest("?lat=45.76864173087472&lon=4.836915452991425"))
    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls[0] as
      | [string, RequestInit]
      | undefined
    expect(call).toBeDefined()
    const [url, init] = call!
    expect(url).toContain("lat=45.76864173087472")
    expect(url).toContain("lon=4.836915452991425")
    expect(url).toContain("format=jsonv2")
    expect(url).toContain("addressdetails=1")
    expect(url).toContain("zoom=18")
    expect(init.cache).toBe("no-store")
    const headers = init.headers as Record<string, string>
    expect(headers["User-Agent"]).toBeTruthy()
    expect(headers["Accept"]).toBe("application/json")
  })

  it("returns 502 when Nominatim responds non-OK", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error("no body")) })
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    expect(res.status).toBe(502)
  })

  it("returns 502 when fetch throws", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    fetchMock.mockRejectedValue(new Error("network down"))
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    expect(res.status).toBe(502)
  })

  it("falls back to town/village/municipality when city is missing", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...sampleNominatim,
          address: {
            ...sampleNominatim.address,
            city: undefined,
            town: "Bourg-en-Bresse",
          },
        }),
    })
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    const body = (await res.json()) as { address: { city: string | null } }
    expect(body.address.city).toBe("Bourg-en-Bresse")
  })

  it("uppercases the country code", async () => {
    requireAdminMock.mockResolvedValue({ id: "user-1" })
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleNominatim),
    })
    const res = await GET(makeRequest("?lat=45.7&lon=4.8"))
    const body = (await res.json()) as { address: { countryCode: string | null } }
    expect(body.address.countryCode).toBe("FR")
  })
})
