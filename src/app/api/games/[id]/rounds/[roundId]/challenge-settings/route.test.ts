import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { resolveIdentityMock, selectGameChallengeSettingsMock, enforceRateLimitMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  selectGameChallengeSettingsMock: vi.fn(),
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
  selectGameChallengeSettings: (...args: unknown[]) => selectGameChallengeSettingsMock(...args),
}))

import { POST } from "./route"

const identity = { userId: null, guestToken: "challenge-settings-guest-token-123", name: "Host" }
const mutation = {
  expectedVersion: 4,
  idempotencyKey: "challenge-settings-key-1234567890",
  spotType: "rails",
  level: 2,
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/games/game-1/rounds/round-1/challenge-settings", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  resolveIdentityMock.mockResolvedValue(identity)
  selectGameChallengeSettingsMock.mockResolvedValue({ id: "game-1", version: 5, trickId: "trick-1" })
})

describe("POST /api/games/[id]/rounds/[roundId]/challenge-settings", () => {
  it("forwards the identity, game, round, and combined settings", async () => {
    const response = await POST(request(mutation), { params: Promise.resolve({ id: "game-1", roundId: "round-1" }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "game-1", version: 5, trickId: "trick-1" })
    expect(enforceRateLimitMock).toHaveBeenCalledWith(expect.any(NextRequest), identity)
    expect(selectGameChallengeSettingsMock).toHaveBeenCalledWith(identity, "game-1", { ...mutation, roundId: "round-1" })
  })

  it("rejects malformed settings before calling the service", async () => {
    const response = await POST(request({ ...mutation, level: 6 }), { params: Promise.resolve({ id: "game-1", roundId: "round-1" }) })

    expect(response.status).toBe(400)
    expect(selectGameChallengeSettingsMock).not.toHaveBeenCalled()
  })
})
