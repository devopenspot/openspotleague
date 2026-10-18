import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { resolveIdentityMock, getGameHistoryMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  getGameHistoryMock: vi.fn(),
}))

vi.mock("@/app/api/games/identity", () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentityMock(...args),
  identityErrorResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  gameErrorResponse: (error: unknown) => new Response(JSON.stringify({ error: String(error) }), { status: 409 }),
}))

vi.mock("@/lib/services/games", () => ({
  getGameHistory: (...args: unknown[]) => getGameHistoryMock(...args),
}))

import { GET } from "./route"

const identity = { userId: "rider-1", guestToken: null, name: "Rider" }
const history = {
  rounds: [],
  attempts: [],
  scoreEvents: [],
  raceLaps: [],
  nextRoundCursor: null,
  nextLapCursor: null,
}

function request(url = "http://localhost/api/games/game-1/history?limit=10&share=share-code&roundCursor=round&lapCursor=lap") {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  resolveIdentityMock.mockResolvedValue(identity)
  getGameHistoryMock.mockResolvedValue(history)
})

describe("GET /api/games/[id]/history", () => {
  it("forwards bounded history pagination and share authorization", async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: "game-1" }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(history)
    expect(resolveIdentityMock).toHaveBeenCalledWith(expect.any(NextRequest), { allowAnonymous: true })
    expect(getGameHistoryMock).toHaveBeenCalledWith(identity, "game-1", {
      shareCode: "share-code",
      limit: 10,
      roundCursor: "round",
      lapCursor: "lap",
    })
  })

  it("rejects limits outside the bounded page contract", async () => {
    const response = await GET(request("http://localhost/api/games/game-1/history?limit=51"), {
      params: Promise.resolve({ id: "game-1" }),
    })

    expect(response.status).toBe(400)
    expect(getGameHistoryMock).not.toHaveBeenCalled()
  })
})
