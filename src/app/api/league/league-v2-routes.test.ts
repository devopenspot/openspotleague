/**
 * Contract tests for the 0007 League routes (video submission, rider entry,
 * standings, ranking) and the score payload v2 — services mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const getSessionUserMock = vi.hoisted(() => vi.fn())
const mocks = vi.hoisted(() => ({
  submitRunVideo: vi.fn(),
  updateMyEntry: vi.fn(),
  submitRunScore: vi.fn(),
  getContestStandings: vi.fn(),
  listLeagueRanking: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUserMock(...args),
}))
vi.mock("@/lib/services/league", () => ({
  submitRunVideo: mocks.submitRunVideo,
  updateMyEntry: mocks.updateMyEntry,
  submitRunScore: mocks.submitRunScore,
}))
vi.mock("@/lib/services/league/standings", () => ({
  getContestStandings: mocks.getContestStandings,
  listLeagueRanking: mocks.listLeagueRanking,
}))
vi.mock("@/app/api/league/rate-limit", () => ({ enforceLeagueRateLimit: vi.fn() }))

import { LeagueDomainError } from "@/lib/league/definitions"
import { POST as postVideo } from "./events/[id]/runs/[runId]/video/route"
import { PATCH as patchEntry } from "./events/[id]/entry/route"
import { POST as postScore } from "./events/[id]/runs/[runId]/scores/route"
import { GET as getStandings } from "./events/[id]/standings/route"
import { GET as getRanking } from "./ranking/route"

const USER = { id: "user-1", email: "rider@example.com" }
const EVENT = "00000000-0000-4000-8000-000000000001"
const RUN = "00000000-0000-4000-8000-000000000002"
const DIVISION = "00000000-0000-4000-8000-000000000003"
const KEY = "00000000-0000-4000-8000-000000000009"

function req(path: string, body?: unknown, method = "POST") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) })

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(USER)
})

describe("POST /api/league/events/[id]/runs/[runId]/video", () => {
  it("requires sign-in", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const res = await postVideo(req("/x", {}), ctx({ id: EVENT, runId: RUN }))
    expect(res.status).toBe(401)
  })

  it("passes the links to the service", async () => {
    mocks.submitRunVideo.mockResolvedValue({ id: EVENT, version: 4 })
    const res = await postVideo(
      req("/x", { expectedVersion: 3, idempotencyKey: KEY, videoUrl: "https://youtu.be/a" }),
      ctx({ id: EVENT, runId: RUN }),
    )
    expect(res.status).toBe(200)
    expect(mocks.submitRunVideo).toHaveBeenCalledWith(USER.id, expect.objectContaining({ eventId: EVENT, runId: RUN, videoUrl: "https://youtu.be/a" }))
  })

  it("maps a passed deadline and a foreign run to errors", async () => {
    mocks.submitRunVideo.mockRejectedValueOnce(new LeagueDomainError("RUN_WINDOW_CLOSED", "The video deadline has passed"))
    const late = await postVideo(req("/x", { expectedVersion: 3, idempotencyKey: KEY, videoUrl: "https://youtu.be/a" }), ctx({ id: EVENT, runId: RUN }))
    expect(late.status).toBeGreaterThanOrEqual(400)
    mocks.submitRunVideo.mockRejectedValueOnce(new LeagueDomainError("NOT_AUTHORIZED", "You can only submit your own runs"))
    const foreign = await postVideo(req("/x", { expectedVersion: 3, idempotencyKey: KEY, videoUrl: "https://youtu.be/a" }), ctx({ id: EVENT, runId: RUN }))
    expect(foreign.status).toBe(403)
  })
})

describe("PATCH /api/league/events/[id]/entry", () => {
  it("validates the category", async () => {
    const res = await patchEntry(
      req("/x", { expectedVersion: 1, idempotencyKey: KEY, entry: { divisionIds: [DIVISION], ageCategory: "adult" } }, "PATCH"),
      ctx({ id: EVENT }),
    )
    expect(res.status).toBe(400)
  })

  it("updates the entry", async () => {
    mocks.updateMyEntry.mockResolvedValue({ id: EVENT, version: 2 })
    const res = await patchEntry(
      req("/x", { expectedVersion: 1, idempotencyKey: KEY, entry: { divisionIds: [DIVISION], ageCategory: "senior", city: "Medellín" } }, "PATCH"),
      ctx({ id: EVENT }),
    )
    expect(res.status).toBe(200)
    expect(mocks.updateMyEntry).toHaveBeenCalledWith(USER.id, expect.objectContaining({ entry: expect.objectContaining({ ageCategory: "senior" }) }))
  })
})

describe("POST /api/league/events/[id]/runs/[runId]/scores (v2)", () => {
  it("forwards elements and the best trick", async () => {
    mocks.submitRunScore.mockResolvedValue({ id: EVENT, version: 9 })
    const scores = { difficulty: 8, style: 7.5, amplitude: 7, consistency: 8, creativity: 6.5 }
    const res = await postScore(
      req("/x", { expectedVersion: 8, idempotencyKey: KEY, scores, elements: ["grinds"], bestTrick: { difficulty: 9, execution: 8 } }),
      ctx({ id: EVENT, runId: RUN }),
    )
    expect(res.status).toBe(200)
    expect(mocks.submitRunScore).toHaveBeenCalledWith(USER.id, expect.objectContaining({ elements: ["grinds"], bestTrick: { difficulty: 9, execution: 8 } }))
  })

  it("returns a clear error for a partial score", async () => {
    mocks.submitRunScore.mockRejectedValue(new LeagueDomainError("SCORE_INVALID", "Set a score for creativity: every criterion is required"))
    const res = await postScore(
      req("/x", { expectedVersion: 8, idempotencyKey: KEY, scores: { difficulty: 8 } }),
      ctx({ id: EVENT, runId: RUN }),
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain("every criterion is required")
  })
})

describe("GET /api/league/events/[id]/standings", () => {
  it("404s when the viewer may not see them", async () => {
    getSessionUserMock.mockResolvedValue(null)
    mocks.getContestStandings.mockResolvedValue(null)
    const res = await getStandings(req("/x", undefined, "GET"), ctx({ id: EVENT }))
    expect(res.status).toBe(404)
    expect(mocks.getContestStandings).toHaveBeenCalledWith(EVENT, null)
  })

  it("returns standings for members", async () => {
    mocks.getContestStandings.mockResolvedValue({ eventId: EVENT, published: false, divisions: [] })
    const res = await getStandings(req("/x", undefined, "GET"), ctx({ id: EVENT }))
    expect(res.status).toBe(200)
    expect(mocks.getContestStandings).toHaveBeenCalledWith(EVENT, USER.id)
  })
})

describe("GET /api/league/ranking", () => {
  it("requires sign-in", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const res = await getRanking(new NextRequest("http://localhost/api/league/ranking"))
    expect(res.status).toBe(401)
  })

  it("validates filters and forwards them", async () => {
    mocks.listLeagueRanking.mockResolvedValue([])
    const bad = await getRanking(new NextRequest("http://localhost/api/league/ranking?format=bowl"))
    expect(bad.status).toBe(400)
    const ok = await getRanking(new NextRequest("http://localhost/api/league/ranking?discipline=roller&format=park&country=CO"))
    expect(ok.status).toBe(200)
    expect(mocks.listLeagueRanking).toHaveBeenCalledWith({ discipline: "roller", format: "park", country: "CO" })
  })
})
