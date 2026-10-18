import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdministratorMock = vi.fn()
const runListAdminUsersMock = vi.fn()

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

vi.mock("@/lib/services/admin/admin-users", () => ({
  runListAdminUsers: (...args: unknown[]) => runListAdminUsersMock(...args),
}))

import { GET } from "./route"

beforeEach(() => {
  vi.resetAllMocks()
  requireAdministratorMock.mockResolvedValue({ id: "admin-1" })
  runListAdminUsersMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    availableRoles: [
      {
        slug: "curator",
        name: "Curator",
        description: "Curated content and media maintenance.",
      },
    ],
  })
})

describe("admin user directory", () => {
  it("requires an administrator before listing accounts", async () => {
    requireAdministratorMock.mockRejectedValue(new Error("Admin only"))

    const response = await GET(new Request("http://localhost/api/admin/users"))

    expect(response.status).toBe(403)
    expect(runListAdminUsersMock).not.toHaveBeenCalled()
  })

  it("passes bounded search and role filters to the service", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/users?q=alice&role=curator&limit=25",
      ),
    )

    expect(response.status).toBe(200)
    expect(runListAdminUsersMock).toHaveBeenCalledWith({
      q: "alice",
      role: "curator",
      limit: 25,
      cursor: null,
    })
  })

  it("rejects unsupported role filters", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/users?role=operator"),
    )

    expect(response.status).toBe(400)
    expect(runListAdminUsersMock).not.toHaveBeenCalled()
  })

  it("rejects malformed cursors", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/users?cursor=not-a-cursor"),
    )

    expect(response.status).toBe(400)
    expect(runListAdminUsersMock).not.toHaveBeenCalled()
  })
})
