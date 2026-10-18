import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const listAdminRegionsMock = vi.fn()
const createRegionMock = vi.fn()

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
  listAdminRegions: (...args: unknown[]) => listAdminRegionsMock(...args),
  createRegion: (...args: unknown[]) => createRegionMock(...args),
}))

const { GET, POST } = await import("@/app/api/admin/regions/route")

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  listAdminRegionsMock.mockResolvedValue([])
  createRegionMock.mockResolvedValue({
    id: "region-1",
    slug: "test-region",
    name: "Test Region",
    description: "",
    imageUrl: null,
    sortOrder: 0,
    countryCount: 0,
  })
})

describe("admin regions list", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await GET()
    expect(response.status).toBe(403)
    expect(listAdminRegionsMock).not.toHaveBeenCalled()
  })

  it("returns regions list", async () => {
    listAdminRegionsMock.mockResolvedValue([
      {
        id: "region-1",
        slug: "test-region",
        name: "Test Region",
        description: "Description",
        imageUrl: null,
        sortOrder: 0,
        countryCount: 2,
      },
    ])
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].slug).toBe("test-region")
  })
})

describe("admin regions create", () => {
  it("requires administrator access", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ slug: "test", name: "Test" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(403)
    expect(createRegionMock).not.toHaveBeenCalled()
  })

  it("validates required fields", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ slug: "" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(400)
    expect(createRegionMock).not.toHaveBeenCalled()
  })

  it("creates a region", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ slug: "new-region", name: "New Region" }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(201)
    expect(createRegionMock).toHaveBeenCalledWith({
      slug: "new-region",
      name: "New Region",
      description: undefined,
      imageUrl: undefined,
      sortOrder: undefined,
    })
  })
})
