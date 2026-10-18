import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const listAdminCountriesMock = vi.fn()
const createCountryMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireAdministrator: (...args: unknown[]) => requireAdministratorMock(...args),
  authorizationErrorResponse,
}))

vi.mock("@/lib/services/admin/admin-regions", () => ({
  listAdminCountries: (...args: unknown[]) => listAdminCountriesMock(...args),
  createCountry: (...args: unknown[]) => createCountryMock(...args),
}))

const { GET, POST } = await import("@/app/api/admin/countries/route")

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  listAdminCountriesMock.mockResolvedValue([])
  createCountryMock.mockResolvedValue({
    iso2: "JP",
    name: "Japan",
    iso3: "JPN",
    regionId: "123e4567-e89b-12d3-a456-426614174000",
    regionName: "Asia",
    spotCount: 0,
    eventCount: 0,
  })
})

describe("admin countries list", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await GET()
    expect(response.status).toBe(403)
    expect(listAdminCountriesMock).not.toHaveBeenCalled()
  })

  it("returns countries list", async () => {
    listAdminCountriesMock.mockResolvedValue([
      {
        iso2: "US",
        name: "United States",
        iso3: "USA",
        regionId: "region-1",
        regionName: "North America",
        spotCount: 5,
        eventCount: 2,
      },
    ])
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].iso2).toBe("US")
  })
})

describe("admin countries create", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ iso2: "JP", name: "Japan", regionId: "123e4567-e89b-12d3-a456-426614174000" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(403)
    expect(createCountryMock).not.toHaveBeenCalled()
  })

  it("validates iso2", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ iso2: "J", name: "Japan", regionId: "123e4567-e89b-12d3-a456-426614174000" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(400)
    expect(createCountryMock).not.toHaveBeenCalled()
  })

  it("validates iso3", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          iso2: "JP",
          name: "Japan",
          iso3: "TOOLONG",
          regionId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(400)
    expect(createCountryMock).not.toHaveBeenCalled()
  })

  it("validates regionId as UUID", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ iso2: "JP", name: "Japan", regionId: "not-a-uuid" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(400)
    expect(createCountryMock).not.toHaveBeenCalled()
  })

  it("creates a country", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          iso2: "jp",
          name: "Japan",
          iso3: "jpn",
          regionId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(201)
    expect(createCountryMock).toHaveBeenCalledWith({
      iso2: "JP",
      name: "Japan",
      iso3: "JPN",
      regionId: "123e4567-e89b-12d3-a456-426614174000",
    })
  })

  it("creates a country without iso3", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ iso2: "JP", name: "Japan", regionId: "123e4567-e89b-12d3-a456-426614174000" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(201)
    expect(createCountryMock).toHaveBeenCalledWith({
      iso2: "JP",
      name: "Japan",
      iso3: null,
      regionId: "123e4567-e89b-12d3-a456-426614174000",
    })
  })

  it("returns 409 for duplicate country", async () => {
    createCountryMock.mockRejectedValue(new Error('duplicate key value violates unique constraint "countries_pkey"'))
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ iso2: "JP", name: "Japan", regionId: "123e4567-e89b-12d3-a456-426614174000" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Country code or name already exists")
  })

  it("returns 409 for invalid region", async () => {
    createCountryMock.mockRejectedValue(new Error('insert or update on table "countries" violates foreign key constraint "countries_region_id_fkey"'))
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ iso2: "JP", name: "Japan", regionId: "123e4567-e89b-12d3-a456-426614174000" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(409)
  })
})
