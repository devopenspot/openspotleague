import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { type User } from "@/lib/auth/user"

const requireUserMock = vi.fn()
const verifySpotForUserMock = vi.fn()
const unverifySpotForUserMock = vi.fn()
const isVerifiedMock = vi.fn()
const countVerificationsForSpotMock = vi.fn()
const revalidateTagMock = vi.fn()

vi.mock("@/lib/auth/server", () => ({
  requireUser: () => requireUserMock(),
}))

vi.mock("@/lib/services/spot/verified-spots", () => ({
  verifySpotForUser: (...args: unknown[]) => verifySpotForUserMock(...args),
  unverifySpotForUser: (...args: unknown[]) =>
    unverifySpotForUserMock(...args),
  isVerified: (...args: unknown[]) => isVerifiedMock(...args),
  countVerificationsForSpot: (...args: unknown[]) =>
    countVerificationsForSpotMock(...args),
}))

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from "./route"
import { DELETE } from "./[spotId]/route"

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

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/verified-spots", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function makeGetRequest(spotId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/verified-spots?spotId=${spotId}`,
  )
}

function makeDeleteRequest(spotId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/verified-spots/${encodeURIComponent(spotId)}`,
    { method: "DELETE" },
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  requireUserMock.mockResolvedValue(user)
})

describe("GET /api/verified-spots", () => {
  it("returns the count and isVerified=true for a signed-in user", async () => {
    countVerificationsForSpotMock.mockResolvedValue(7)
    isVerifiedMock.mockResolvedValue(true)
    const res = await GET(makeGetRequest("spot-1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      spotId: "spot-1",
      count: 7,
      isVerified: true,
    })
    expect(countVerificationsForSpotMock).toHaveBeenCalledWith("spot-1")
    expect(isVerifiedMock).toHaveBeenCalledWith(user.id, "spot-1")
  })

  it("returns isVerified=null for anonymous users", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"))
    countVerificationsForSpotMock.mockResolvedValue(2)
    const res = await GET(makeGetRequest("spot-1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      spotId: "spot-1",
      count: 2,
      isVerified: null,
    })
    expect(isVerifiedMock).not.toHaveBeenCalled()
  })

  it("returns 400 when spotId is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/verified-spots"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when the spot does not exist", async () => {
    countVerificationsForSpotMock.mockRejectedValue(
      new Error("Spot not found: x"),
    )
    const res = await GET(makeGetRequest("x"))
    expect(res.status).toBe(404)
  })

  it("returns 500 on other errors", async () => {
    countVerificationsForSpotMock.mockRejectedValue(new Error("db down"))
    const res = await GET(makeGetRequest("spot-1"))
    expect(res.status).toBe(500)
  })
})

describe("POST /api/verified-spots", () => {
  it("verifies a spot and returns the new count", async () => {
    verifySpotForUserMock.mockResolvedValue(7)
    const res = await POST(makePostRequest({ spotId: "spot-1" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      count: 7,
      isVerified: true,
    })
    expect(verifySpotForUserMock).toHaveBeenCalledWith(user.id, "spot-1")
  })

  it("returns 401 when not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"))
    const res = await POST(makePostRequest({ spotId: "spot-1" }))
    expect(res.status).toBe(401)
    expect(verifySpotForUserMock).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makePostRequest("{not json"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for empty body", async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 when spotId is missing", async () => {
    const res = await POST(makePostRequest({ foo: "bar" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 on extra keys (strict schema)", async () => {
    const res = await POST(
      makePostRequest({ spotId: "spot-1", garbage: "x" }),
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when the spot does not exist", async () => {
    verifySpotForUserMock.mockRejectedValue(new Error("Spot not found: x"))
    const res = await POST(makePostRequest({ spotId: "x" }))
    expect(res.status).toBe(404)
  })

  it("returns 500 on other errors", async () => {
    verifySpotForUserMock.mockRejectedValue(new Error("db down"))
    const res = await POST(makePostRequest({ spotId: "spot-1" }))
    expect(res.status).toBe(500)
  })
})

describe("DELETE /api/verified-spots/[spotId]", () => {
  it("unverifies a spot and returns the new count", async () => {
    unverifySpotForUserMock.mockResolvedValue(5)
    const res = await DELETE(makeDeleteRequest("spot-1"), {
      params: Promise.resolve({ spotId: "spot-1" }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      count: 5,
      isVerified: false,
    })
    expect(unverifySpotForUserMock).toHaveBeenCalledWith(user.id, "spot-1")
  })

  it("returns 401 when not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"))
    const res = await DELETE(makeDeleteRequest("spot-1"), {
      params: Promise.resolve({ spotId: "spot-1" }),
    })
    expect(res.status).toBe(401)
    expect(unverifySpotForUserMock).not.toHaveBeenCalled()
  })

  it("returns 500 on errors", async () => {
    unverifySpotForUserMock.mockRejectedValue(new Error("db down"))
    const res = await DELETE(makeDeleteRequest("spot-1"), {
      params: Promise.resolve({ spotId: "spot-1" }),
    })
    expect(res.status).toBe(500)
  })
})
