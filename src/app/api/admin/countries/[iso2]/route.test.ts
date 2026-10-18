import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const updateCountryMock = vi.fn()
const deleteCountryMock = vi.fn()

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
  updateCountry: (...args: unknown[]) => updateCountryMock(...args),
  deleteCountry: (...args: unknown[]) => deleteCountryMock(...args),
}))

const { PATCH, DELETE } = await import("@/app/api/admin/countries/[iso2]/route")

const context = { params: Promise.resolve({ iso2: "US" }) }

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  updateCountryMock.mockResolvedValue({
    iso2: "US",
    name: "United States",
    iso3: "USA",
    regionId: "region-1",
    regionName: "North America",
    spotCount: 5,
    eventCount: 2,
  })
  deleteCountryMock.mockResolvedValue(undefined)
})

describe("admin country update", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "USA" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(403)
    expect(updateCountryMock).not.toHaveBeenCalled()
  })

  it("validates ISO3 format", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ iso3: "invalid" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(400)
    expect(updateCountryMock).not.toHaveBeenCalled()
  })

  it("validates regionId as UUID", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ regionId: "not-a-uuid" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(400)
    expect(updateCountryMock).not.toHaveBeenCalled()
  })

  it("updates a country", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "United States of America", iso3: "USA" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(updateCountryMock).toHaveBeenCalledWith("US", {
      name: "United States of America",
      iso3: "USA",
      regionId: undefined,
    })
  })

  it("updates country region", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ regionId: "123e4567-e89b-12d3-a456-426614174000" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(updateCountryMock).toHaveBeenCalledWith("US", {
      name: undefined,
      iso3: null,
      regionId: "123e4567-e89b-12d3-a456-426614174000",
    })
  })

  it("returns 404 for not found", async () => {
    updateCountryMock.mockRejectedValue(new Error("Country not found: US"))
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(404)
  })
})

describe("admin country delete", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(403)
    expect(deleteCountryMock).not.toHaveBeenCalled()
  })

  it("deletes a country", async () => {
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(204)
    expect(deleteCountryMock).toHaveBeenCalledWith("US")
  })

  it("returns 404 for not found", async () => {
    deleteCountryMock.mockRejectedValue(new Error("Country not found: US"))
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(404)
  })
})
