import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { type User } from "@/lib/auth/user"

const requireUserMock = vi.fn()
const listSavedSpotsForUserMock = vi.fn()
const saveSpotForUserMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock("@/lib/auth/server", () => ({
  requireUser: () => requireUserMock(),
}))

vi.mock("@/lib/services/spot/saved-spots", () => ({
  listSavedSpotsForUser: (...args: unknown[]) =>
    listSavedSpotsForUserMock(...args),
  saveSpotForUser: (...args: unknown[]) => saveSpotForUserMock(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: vi.fn(),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from "./route"

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
  return new NextRequest("http://localhost/api/saved-spots", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  requireUserMock.mockResolvedValue(user)
})

describe("GET /api/saved-spots", () => {
  it("returns 200 with the user's saved spots", async () => {
    const expected = { items: [{ spotId: "spot-1" }], nextCursor: null }
    listSavedSpotsForUserMock.mockResolvedValue(expected)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expected)
    expect(listSavedSpotsForUserMock).toHaveBeenCalledWith(user.id, {
      limit: 200,
    })
  })

  it("returns 401 when not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 500 when the service throws", async () => {
    listSavedSpotsForUserMock.mockRejectedValue(new Error("db down"))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe("POST /api/saved-spots", () => {
  it("saves a spot and revalidates /saved", async () => {
    saveSpotForUserMock.mockResolvedValue(undefined)
    const res = await POST(makePostRequest({ spotId: "spot-1" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(saveSpotForUserMock).toHaveBeenCalledWith(user.id, "spot-1")
  })

  it("returns 401 when not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"))
    const res = await POST(makePostRequest({ spotId: "spot-1" }))
    expect(res.status).toBe(401)
    expect(saveSpotForUserMock).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makePostRequest("{not json"))
    expect(res.status).toBe(400)
    expect(saveSpotForUserMock).not.toHaveBeenCalled()
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
    saveSpotForUserMock.mockRejectedValue(new Error("Spot not found: x"))
    const res = await POST(makePostRequest({ spotId: "x" }))
    expect(res.status).toBe(404)
  })

  it("returns 500 on other errors", async () => {
    saveSpotForUserMock.mockRejectedValue(new Error("db down"))
    const res = await POST(makePostRequest({ spotId: "spot-1" }))
    expect(res.status).toBe(500)
  })
})
