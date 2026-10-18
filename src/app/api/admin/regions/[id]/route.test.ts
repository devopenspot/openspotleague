import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const updateRegionMock = vi.fn()
const deleteRegionMock = vi.fn()

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
  updateRegion: (...args: unknown[]) => updateRegionMock(...args),
  deleteRegion: (...args: unknown[]) => deleteRegionMock(...args),
}))

const { PATCH, DELETE } = await import("@/app/api/admin/regions/[id]/route")

const context = { params: Promise.resolve({ id: "region-1" }) }

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  updateRegionMock.mockResolvedValue({
    id: "region-1",
    slug: "updated-region",
    name: "Updated Region",
    description: "Updated",
    imageUrl: null,
    sortOrder: 1,
    countryCount: 0,
  })
  deleteRegionMock.mockResolvedValue(undefined)
})

describe("admin region update", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(403)
    expect(updateRegionMock).not.toHaveBeenCalled()
  })

  it("validates slug format", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ slug: "Invalid Slug!" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(400)
    expect(updateRegionMock).not.toHaveBeenCalled()
  })

  it("updates a region", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Region", slug: "updated-region" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(updateRegionMock).toHaveBeenCalledWith("region-1", {
      name: "Updated Region",
      slug: "updated-region",
      description: undefined,
      imageUrl: undefined,
      sortOrder: undefined,
    })
  })

  it("returns 404 for not found", async () => {
    updateRegionMock.mockRejectedValue(new Error("Region not found: region-1"))
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

describe("admin region delete", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(403)
    expect(deleteRegionMock).not.toHaveBeenCalled()
  })

  it("deletes a region", async () => {
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(204)
    expect(deleteRegionMock).toHaveBeenCalledWith("region-1")
  })

  it("returns 409 when region has countries", async () => {
    // Mirror the repository's wrapped FK error: friendly message with the
    // original pg error attached as cause (isForeignKeyViolation walks it).
    const wrapped = new Error(
      "Cannot delete region with associated countries. Reassign or delete countries first.",
    ) as Error & { cause?: unknown }
    wrapped.cause = new Error(
      'update or delete on table "regions" violates foreign key constraint "regions_id_fkey"',
    )
    deleteRegionMock.mockRejectedValue(wrapped)
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(409)
  })

  it("returns 500 with a generic body for unknown delete failures", async () => {
    deleteRegionMock.mockRejectedValue(new Error("unexpected storage failure"))
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("Internal error")
  })
})
