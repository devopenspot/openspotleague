import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { resolveIdentityMock, cancelGameMock, enforceRateLimitMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  cancelGameMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
}))

vi.mock("@/app/api/games/identity", () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentityMock(...args),
  identityErrorResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  gameErrorResponse: (error: unknown) => new Response(JSON.stringify({ error: String(error) }), { status: 409 }),
}))

vi.mock("@/app/api/games/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
}))

vi.mock("@/lib/services/games", () => ({
  cancelGame: (...args: unknown[]) => cancelGameMock(...args),
}))

import { POST } from "./route"

const identity = { userId: "rider-1", guestToken: null, name: "Rider" }
const mutation = { expectedVersion: 4, idempotencyKey: "cancel-key-1234567890123456789012" }

function request(body: unknown) {
  return new NextRequest("http://localhost/api/games/game-1/cancel", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  resolveIdentityMock.mockResolvedValue(identity)
  cancelGameMock.mockResolvedValue({ id: "game-1", version: 5, status: "cancelled" })
})

describe("POST /api/games/[id]/cancel", () => {
  it("forwards a participant cancellation to the service", async () => {
    const response = await POST(request(mutation), { params: Promise.resolve({ id: "game-1" }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "game-1", version: 5, status: "cancelled" })
    expect(enforceRateLimitMock).toHaveBeenCalledWith(expect.any(NextRequest), identity)
    expect(cancelGameMock).toHaveBeenCalledWith(identity, "game-1", mutation)
  })

  it("rejects malformed mutation input before calling the service", async () => {
    const response = await POST(request({ expectedVersion: -1 }), { params: Promise.resolve({ id: "game-1" }) })

    expect(response.status).toBe(400)
    expect(cancelGameMock).not.toHaveBeenCalled()
  })
})
