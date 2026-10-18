import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const { resolveIdentityMock, requireUserMock, listOpenTrainingGamesMock, listGamesForUserMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  requireUserMock: vi.fn(),
  listOpenTrainingGamesMock: vi.fn(),
  listGamesForUserMock: vi.fn(),
}))

vi.mock("@/app/api/games/identity", () => ({
  resolveIdentity: (...args: unknown[]) => resolveIdentityMock(...args),
  identityErrorResponse: (error: unknown) => new Response(JSON.stringify({ error: String(error) }), { status: 401 }),
  gameErrorResponse: (error: unknown) => new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
}))

vi.mock("@/lib/auth/server", () => ({
  requireUser: () => requireUserMock(),
}))

vi.mock("@/lib/services/games", () => ({
  createGame: vi.fn(),
  listGamesForUser: (...args: unknown[]) => listGamesForUserMock(...args),
  listOpenTrainingGames: (...args: unknown[]) => listOpenTrainingGamesMock(...args),
}))

vi.mock("@/app/api/games/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}))

import { GET } from "./route"

const userIdentity = { userId: "user-1", guestToken: null, name: "Rider" }
const guestIdentity = { userId: null, guestToken: "guest-token-12345678901234567890", name: "Guest Rider" }

beforeEach(() => {
  vi.resetAllMocks()
  requireUserMock.mockResolvedValue({ id: "user-1" })
})

describe("GET /api/games open training list", () => {
  it("lists open training games for the authenticated creator", async () => {
    const games = [{ id: "game-1", status: "lobby", mode: "training", version: 0 }]
    resolveIdentityMock.mockResolvedValue(userIdentity)
    listOpenTrainingGamesMock.mockResolvedValue(games)

    const response = await GET(new NextRequest("http://localhost/api/games?mode=training&status=open"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(games)
    expect(listOpenTrainingGamesMock).toHaveBeenCalledWith(userIdentity)
  })

  it("lists open training games for a guest token", async () => {
    resolveIdentityMock.mockResolvedValue(guestIdentity)
    listOpenTrainingGamesMock.mockResolvedValue([])

    const response = await GET(new NextRequest("http://localhost/api/games?mode=training&status=open", {
      headers: { "x-guest-token": guestIdentity.guestToken },
    }))

    expect(response.status).toBe(200)
    expect(listOpenTrainingGamesMock).toHaveBeenCalledWith(guestIdentity)
  })

  it("keeps the existing authenticated history query unchanged", async () => {
    listGamesForUserMock.mockResolvedValue([])

    const response = await GET(new NextRequest("http://localhost/api/games?limit=10"))

    expect(response.status).toBe(200)
    expect(listGamesForUserMock).toHaveBeenCalledWith("user-1", 10)
    expect(listOpenTrainingGamesMock).not.toHaveBeenCalled()
  })
})
