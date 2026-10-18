import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const updateSportMock = vi.fn()
const deleteSportMock = vi.fn()

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
  updateSport: (...args: unknown[]) => updateSportMock(...args),
  deleteSport: (...args: unknown[]) => deleteSportMock(...args),
}))

import { DELETE, PATCH } from "./route"

const context = { params: Promise.resolve({ slug: "skateboard" }) }

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  updateSportMock.mockResolvedValue({ slug: "skateboard", name: "Skateboard", sortOrder: 0 })
  deleteSportMock.mockResolvedValue(undefined)
})

describe("admin sport maintenance", () => {
  it("requires the unrestricted admin role for edits", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Boards" }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(requireAdministratorMock).toHaveBeenCalledWith()
  })

  it("blocks a non-admin delete before the service call", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await DELETE(new Request("http://localhost"), context)
    expect(response.status).toBe(403)
    expect(deleteSportMock).not.toHaveBeenCalled()
  })
})
