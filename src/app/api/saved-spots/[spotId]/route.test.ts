import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { type User } from "@/lib/auth/user"

const requireUserMock = vi.fn()
const unsaveSpotForUserMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock("@/lib/auth/server", () => ({
  requireUser: () => requireUserMock(),
}))

vi.mock("@/lib/services/spot/saved-spots", () => ({
  unsaveSpotForUser: (...args: unknown[]) => unsaveSpotForUserMock(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: vi.fn(),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { DELETE } from "./route"

const user: User = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  initials: "TU",
  avatarUrl: null,
  canAccessAdmin: true,
  canCurate: true,
  isAdministrator: true,
}

const fakeContext = (spotId: string) => ({
  params: Promise.resolve({ spotId }),
})

function makeRequest(spotId: string): NextRequest {
  return new NextRequest(`http://localhost/api/saved-spots/${spotId}`, {
    method: "DELETE",
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  requireUserMock.mockResolvedValue(user)
  unsaveSpotForUserMock.mockResolvedValue(undefined)
})

describe("DELETE /api/saved-spots/[spotId]", () => {
  it("returns 204 and calls the service", async () => {
    const res = await DELETE(
      makeRequest("spot-1"),
      fakeContext("spot-1") as never,
    )
    expect(res.status).toBe(204)
    expect(unsaveSpotForUserMock).toHaveBeenCalledWith(user.id, "spot-1")
  })

  it("returns 401 when not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"))
    const res = await DELETE(
      makeRequest("spot-1"),
      fakeContext("spot-1") as never,
    )
    expect(res.status).toBe(401)
    expect(unsaveSpotForUserMock).not.toHaveBeenCalled()
  })

  it("returns 500 when the service throws", async () => {
    unsaveSpotForUserMock.mockRejectedValue(new Error("db down"))
    const res = await DELETE(
      makeRequest("spot-1"),
      fakeContext("spot-1") as never,
    )
    expect(res.status).toBe(500)
  })
})
