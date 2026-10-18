import { beforeEach, describe, expect, it, vi } from "vitest"

const requireCurationAccessMock = vi.fn()
const listSportsMock = vi.fn()

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
vi.mock("@/lib/services/taxonomy/taxonomy", () => ({
  listSports: (...args: unknown[]) => listSportsMock(...args),
}))

import { GET } from "./route"

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue({ id: "curator-1" })
  listSportsMock.mockResolvedValue([])
})

describe("GET /api/admin/sports", () => {
  it("uses the shared content-read permission", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(requireCurationAccessMock).toHaveBeenCalledWith("content.read")
  })

  it("denies users without the permission", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Admin only"))
    expect((await GET()).status).toBe(403)
    expect(listSportsMock).not.toHaveBeenCalled()
  })
})
