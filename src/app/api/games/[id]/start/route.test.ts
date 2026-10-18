import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const { resolveIdentityMock, startGameMock, enforceRateLimitMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  startGameMock: vi.fn(),
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
  startGame: (...args: unknown[]) => startGameMock(...args),
}))

import { POST } from "./route"

const identity = { userId: null, guestToken: "start-route-guest-token-123", name: "Host" }
const mutation = { expectedVersion: 4, idempotencyKey: "start-key-1234567890123456789012" }

function request(body: unknown) {
  return new NextRequest("http://localhost/api/games/game-1/start", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  resolveIdentityMock.mockResolvedValue(identity)
  startGameMock.mockResolvedValue({ id: "game-1", version: 5, status: "active" })
})

describe("POST /api/games/[id]/start", () => {
  it("forwards the identity, game ID, and mutation to the service", async () => {
    const response = await POST(request(mutation), { params: Promise.resolve({ id: "game-1" }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "game-1", version: 5, status: "active" })
    expect(enforceRateLimitMock).toHaveBeenCalledWith(expect.any(NextRequest), identity)
    expect(startGameMock).toHaveBeenCalledWith(identity, "game-1", mutation)
  })

  it("forwards an explicit early-start request", async () => {
    const earlyStart = { ...mutation, startNow: true }
    const response = await POST(request(earlyStart), { params: Promise.resolve({ id: "game-1" }) })

    expect(response.status).toBe(200)
    expect(startGameMock).toHaveBeenCalledWith(identity, "game-1", earlyStart)
  })

  it("rejects malformed mutation input before calling the service", async () => {
    const response = await POST(request({ expectedVersion: -1 }), { params: Promise.resolve({ id: "game-1" }) })

    expect(response.status).toBe(400)
    expect(startGameMock).not.toHaveBeenCalled()
  })
})
