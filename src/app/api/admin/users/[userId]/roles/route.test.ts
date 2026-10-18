import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const listUserRolesMock = vi.fn()
const replaceUserRolesMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
    headers: { "Content-Type": "application/json" },
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireAdministrator: (...args: unknown[]) => requireAdministratorMock(...args),
  authorizationErrorResponse,
}))

vi.mock("@/lib/services/admin/admin-roles", () => ({
  listUserRoles: (...args: unknown[]) => listUserRolesMock(...args),
  replaceUserRoles: (...args: unknown[]) => replaceUserRolesMock(...args),
}))

import { GET, PUT } from "./route"

const context = { params: Promise.resolve({ userId: "user-1" }) }

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  listUserRolesMock.mockResolvedValue([])
  replaceUserRolesMock.mockResolvedValue([
    {
      slug: "curator",
      name: "Curator",
      grantedBy: "admin-1",
      createdAt: "2026-08-17T12:00:00.000Z",
    },
  ])
})

describe("admin role management", () => {
  it("requires the unrestricted admin role before looking up a target", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))
    const response = await GET(new Request("http://localhost"), context)
    expect(response.status).toBe(403)
    expect(listUserRolesMock).not.toHaveBeenCalled()
  })

  it("replaces assignments through the transactional service", async () => {
    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ roles: ["curator"] }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(replaceUserRolesMock).toHaveBeenCalledWith(
      "user-1",
      ["curator"],
      "admin-1",
    )
  })

  it("rejects unknown role slugs before mutation", async () => {
    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ roles: ["operator"] }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(400)
    expect(replaceUserRolesMock).not.toHaveBeenCalled()
  })

  it("returns a conflict when an update would remove the last administrator", async () => {
    replaceUserRolesMock.mockRejectedValue(
      new Error("The system must retain at least one administrator"),
    )

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ roles: ["curator"] }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )

    expect(response.status).toBe(409)
  })
})
