import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const {
  resolveAuthenticatedIdentityMock,
  resolveIdentityMock,
  findNearbyChallengeSpotMock,
  enforceRateLimitMock,
} = vi.hoisted(() => ({
  resolveAuthenticatedIdentityMock: vi.fn(),
  resolveIdentityMock: vi.fn(),
  findNearbyChallengeSpotMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
}))

vi.mock("@/app/api/games/identity", () => ({
  resolveAuthenticatedIdentity: (...args: unknown[]) =>
    resolveAuthenticatedIdentityMock(...args),
  resolveIdentity: (...args: unknown[]) => resolveIdentityMock(...args),
  identityErrorResponse: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  gameErrorResponse: (error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 409 }),
}))

vi.mock("@/app/api/games/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimitMock(...args),
}))

vi.mock("@/lib/services/games", () => ({
  findNearbyChallengeSpot: (...args: unknown[]) =>
    findNearbyChallengeSpotMock(...args),
}))

import { GET } from "./route"

const identity = { userId: "user-1", guestToken: null, name: "Rider" }
const spot = {
  id: "spot-1",
  location: { lat: 40.4168, lon: -3.7038 },
}

function request(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  resolveAuthenticatedIdentityMock.mockResolvedValue(identity)
  resolveIdentityMock.mockResolvedValue(identity)
  findNearbyChallengeSpotMock.mockResolvedValue(spot)
})

describe("GET /api/games/nearby-spot", () => {
  it("returns the nearest challenge spot for an authenticated rider", async () => {
    const response = await GET(
      request(
        "http://localhost/api/games/nearby-spot?lat=40.4168&lon=-3.7038&disciplineSlug=skateboard",
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      spot,
      distanceMeters: 0,
    })
    expect(findNearbyChallengeSpotMock).toHaveBeenCalledWith({
      latitude: 40.4168,
      longitude: -3.7038,
      disciplineSlug: "skateboard",
    })
    expect(enforceRateLimitMock).toHaveBeenCalledWith(expect.any(NextRequest), identity)
  })

  it("returns an empty spot when no compatible place is nearby", async () => {
    findNearbyChallengeSpotMock.mockResolvedValue(null)

    const response = await GET(
      request(
        "http://localhost/api/games/nearby-spot?lat=40.4168&lon=-3.7038&disciplineSlug=skateboard",
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ spot: null, distanceMeters: null })
  })

  it("rejects malformed location queries", async () => {
    const response = await GET(
      request(
        "http://localhost/api/games/nearby-spot?lat=not-a-number&lon=-3.7038&disciplineSlug=skateboard",
      ),
    )

    expect(response.status).toBe(400)
    expect(findNearbyChallengeSpotMock).not.toHaveBeenCalled()
  })
})
