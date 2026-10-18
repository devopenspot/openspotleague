import { beforeEach, describe, expect, it, vi } from "vitest"

const requireCurationAccessMock = vi.fn()
const requireAdministratorMock = vi.fn()
const listAdminTaxonomyMock = vi.fn()
const createSpotTypeMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: (...args: unknown[]) => requireCurationAccessMock(...args),
  requireAdministrator: (...args: unknown[]) => requireAdministratorMock(...args),
  authorizationErrorResponse,
}))
vi.mock("@/lib/services/taxonomy/taxonomy", () => ({
  listAdminTaxonomy: (...args: unknown[]) => listAdminTaxonomyMock(...args),
  createSpotType: (...args: unknown[]) => createSpotTypeMock(...args),
}))

import { GET, POST } from "./route"

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue({ id: "curator-1" })
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  listAdminTaxonomyMock.mockResolvedValue({ spotTypes: [] })
  createSpotTypeMock.mockResolvedValue({ slug: "plaza", name: "Plaza", sortOrder: 0 })
})

describe("admin spot-type maintenance", () => {
  it("allows content readers to load the picker", async () => {
    expect((await GET()).status).toBe(200)
    expect(requireCurationAccessMock).toHaveBeenCalledWith("content.read")
  })

  it("keeps taxonomy creation admin-only", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ slug: "plaza", name: "Plaza", sortOrder: 0 }),
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(response.status).toBe(403)
    expect(createSpotTypeMock).not.toHaveBeenCalled()
  })
})
