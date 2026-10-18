import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const updateSpotTypeMock = vi.fn()
const deleteSpotTypeMock = vi.fn()

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
vi.mock("@/lib/services/taxonomy/taxonomy", () => ({
  updateSpotType: (...args: unknown[]) => updateSpotTypeMock(...args),
  deleteSpotType: (...args: unknown[]) => deleteSpotTypeMock(...args),
}))

import { DELETE, PATCH } from "./route"

const context = { params: Promise.resolve({ slug: "plaza" }) }

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  updateSpotTypeMock.mockResolvedValue({ slug: "plaza", name: "Plaza", sortOrder: 0 })
  deleteSpotTypeMock.mockResolvedValue(undefined)
})

describe("admin spot-type edits", () => {
  it("requires the shared admin role boundary", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Plaza" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(requireAdministratorMock).toHaveBeenCalledWith()
  })

  it("blocks unauthorized deletes", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Not signed in"))
    expect((await DELETE(new Request("http://localhost"), context)).status).toBe(401)
    expect(deleteSpotTypeMock).not.toHaveBeenCalled()
  })
})
