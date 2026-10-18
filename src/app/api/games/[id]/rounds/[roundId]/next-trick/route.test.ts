import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { resolveIdentityMock, retrieveAlternativeTrickMock, enforceRateLimitMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  retrieveAlternativeTrickMock: vi.fn(),
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
  retrieveAlternativeTrick: (...args: unknown[]) => retrieveAlternativeTrickMock(...args),
}))

import { POST } from "./route"

const identity = { userId: "user-1", guestToken: null, name: "Leader" }
const requestBody = {
  expectedVersion: 4,
  idempotencyKey: "alternative-trick-key-1234567890",
  excludedTrickIds: ["current-trick", "alternative-one"],
}

function request(body: unknown) {
  return new NextRequest("http://localhost/api/games/game-1/rounds/round-1/next-trick", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  resolveIdentityMock.mockResolvedValue(identity)
  retrieveAlternativeTrickMock.mockResolvedValue({
    id: "game-1",
    version: 4,
    trickId: "alternative-two",
    trick: {
      id: "alternative-two",
      name: "Backside 180",
      description: "Rotate cleanly on the rail.",
      level: 1,
      discipline: "skateboard",
      compatibleSpotTypes: ["rails"],
    },
  })
})

describe("POST /api/games/[id]/rounds/[roundId]/next-trick", () => {
  it("forwards the leader request and returns an ephemeral trick", async () => {
    const response = await POST(request(requestBody), {
      params: Promise.resolve({ id: "game-1", roundId: "round-1" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: "game-1",
      version: 4,
      trickId: "alternative-two",
    })
    expect(enforceRateLimitMock).toHaveBeenCalledWith(expect.any(NextRequest), identity)
    expect(retrieveAlternativeTrickMock).toHaveBeenCalledWith(identity, "game-1", {
      ...requestBody,
      roundId: "round-1",
    })
  })

  it("rejects requests without excluded trick ids before calling the service", async () => {
    const response = await POST(
      request({ ...requestBody, excludedTrickIds: [] }),
      { params: Promise.resolve({ id: "game-1", roundId: "round-1" }) },
    )

    expect(response.status).toBe(400)
    expect(retrieveAlternativeTrickMock).not.toHaveBeenCalled()
  })
})
