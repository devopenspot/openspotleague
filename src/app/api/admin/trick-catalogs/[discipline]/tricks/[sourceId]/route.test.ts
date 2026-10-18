import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const requireCurationAccessMock = vi.fn()
const requireTrickCurationAccessMock = vi.fn()
const saveTrickMock = vi.fn()
const deleteTrickMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
    headers: { "Content-Type": "application/json" },
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: (...args: unknown[]) => requireCurationAccessMock(...args),
  requireTrickCurationAccess: (...args: unknown[]) => requireTrickCurationAccessMock(...args),
  authorizationErrorResponse,
}))

vi.mock("@/lib/services/taxonomy/trick-catalogs", () => ({
  saveTrick: (...args: unknown[]) => saveTrickMock(...args),
  deleteTrick: (...args: unknown[]) => deleteTrickMock(...args),
  runListCurrentTrickCatalogs: () => Promise.resolve([
    {
      disciplineSlug: "skateboard",
      challengeKey: "skate",
      gameName: "Play a Skate",
      eliminationWord: "SKATE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
      version: 2,
      tricks: [],
    },
  ]),
}))

import { DELETE, PUT } from "./route"

const trick = {
  sourceId: "boardslide",
  name: "Boardslide",
  description: "Slide the board across the rail.",
  level: 1 as const,
  compatibleSpotTypes: ["rails"],
  categories: [] as string[],
}

const context = (sourceId = trick.sourceId) => ({
  params: Promise.resolve({ discipline: "skateboard", sourceId }),
})

function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/trick-catalogs/skateboard/tricks/boardslide", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "If-Match": '"2026-01-01T00:00:00.000Z"',
    },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue({ id: "admin-1" })
  requireTrickCurationAccessMock.mockResolvedValue({ id: "admin-1" })
  saveTrickMock.mockResolvedValue(trick)
  deleteTrickMock.mockResolvedValue(undefined)
})

describe("PUT /api/admin/trick-catalogs/[discipline]/tricks/[sourceId]", () => {
  it("saves one validated trick", async () => {
    const response = await PUT(request("PUT", trick), context())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...trick, updatedAt: "2026-01-01T00:00:01.000Z" })
    expect(response.headers.get("etag")).toBe('"2026-01-01T00:00:01.000Z"')
    expect(saveTrickMock).toHaveBeenCalledWith("skateboard", trick, {
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      actorId: "admin-1",
    })
  })

  it("rejects a source id that does not match the route", async () => {
    const response = await PUT(request("PUT", { ...trick, sourceId: "kickflip" }), context())

    expect(response.status).toBe(400)
    expect(saveTrickMock).not.toHaveBeenCalled()
  })

  it("rejects an invalid trick", async () => {
    const response = await PUT(request("PUT", { ...trick, compatibleSpotTypes: [] }), context())

    expect(response.status).toBe(400)
    expect(saveTrickMock).not.toHaveBeenCalled()
  })

  it("requires an authenticated admin", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Not signed in"))
    requireTrickCurationAccessMock.mockRejectedValue(new Error("Not signed in"))

    expect((await PUT(request("PUT", trick), context())).status).toBe(401)
  })

  it("does not mislabel a database outage as a conflict", async () => {
    saveTrickMock.mockRejectedValue(new Error("ETIMEDOUT"))

    expect((await PUT(request("PUT", trick), context())).status).toBe(503)
  })
})

describe("DELETE /api/admin/trick-catalogs/[discipline]/tricks/[sourceId]", () => {
  it("deletes one trick", async () => {
    const response = await DELETE(request("DELETE"), context())

    expect(response.status).toBe(204)
    expect(deleteTrickMock).toHaveBeenCalledWith("skateboard", "boardslide", {
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      actorId: "admin-1",
    })
  })

  it("returns not found errors from the service", async () => {
    deleteTrickMock.mockRejectedValue(new Error("Trick not found: boardslide"))

    expect((await DELETE(request("DELETE"), context())).status).toBe(404)
  })
})
