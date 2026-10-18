import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as AuthorizationModule from "@/lib/services/profile/authorization"

const requireCurationAccessMock = vi.fn()
const listCurrentTrickCatalogsMock = vi.fn()
const getAuthorizationSnapshotMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: (...args: unknown[]) => requireCurationAccessMock(...args),
  authorizationErrorResponse,
}))
vi.mock("@/lib/services/taxonomy/trick-catalogs", () => ({
  listCurrentTrickCatalogs: (...args: unknown[]) => listCurrentTrickCatalogsMock(...args),
}))
vi.mock("@/lib/services/profile/authorization", async () => {
  const actual = (await vi.importActual("@/lib/services/profile/authorization")) as typeof AuthorizationModule
  return { ...actual, getAuthorizationSnapshot: (...args: unknown[]) => getAuthorizationSnapshotMock(...args) }
})

import { GET } from "./route"

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue({ id: "curator-1" })
  listCurrentTrickCatalogsMock.mockResolvedValue([])
  getAuthorizationSnapshotMock.mockResolvedValue({ roles: new Set(["admin"]), permissions: new Set(["content.read"]), countryScopes: new Set(), disciplineScopes: new Set() })
})

describe("GET /api/admin/trick-catalogs", () => {
  it("uses the shared content-read boundary", async () => {
    expect((await GET()).status).toBe(200)
    expect(requireCurationAccessMock).toHaveBeenCalledWith("content.read")
  })

  it("does not query catalogs for an unauthorized user", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Not signed in"))
    expect((await GET()).status).toBe(401)
    expect(listCurrentTrickCatalogsMock).not.toHaveBeenCalled()
  })
})
