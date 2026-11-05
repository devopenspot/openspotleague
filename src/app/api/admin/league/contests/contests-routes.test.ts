/**
 * Contest curation routes — services and auth mocked. Covers the country
 * scope guard (create, existing contest, country moves), the curator flags
 * passed to the league writers, and error mapping.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getServerUserFromCookies: vi.fn(),
  requireContestCurationAccess: vi.fn(),
  resolveScopeCountryCode: vi.fn(),
  createLeagueEvent: vi.fn(),
  listContestsForCuration: vi.fn(),
  getContestForCuration: vi.fn(),
  getContestCountryCode: vi.fn(),
  updateLeagueEventConfig: vi.fn(),
  cancelEvent: vi.fn(),
}))

vi.mock("@/lib/auth/auth", () => ({
  getServerUserFromCookies: mocks.getServerUserFromCookies,
}))
vi.mock("@/lib/auth/server", async () => {
  const { NextResponse } = await import("next/server")
  const { AuthorizationError } = await import("@/lib/services/profile/authorization")
  return {
    requireContestCurationAccess: mocks.requireContestCurationAccess,
    authorizationErrorResponse: (error: unknown) =>
      NextResponse.json(
        { error: "auth" },
        { status: error instanceof AuthorizationError ? error.status : 503 },
      ),
  }
})
vi.mock("@/lib/services/country-scope", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/services/country-scope",
  )
  return { ...actual, resolveScopeCountryCode: mocks.resolveScopeCountryCode }
})
vi.mock("@/lib/services/league", () => ({
  createLeagueEvent: mocks.createLeagueEvent,
  listContestsForCuration: mocks.listContestsForCuration,
  getContestForCuration: mocks.getContestForCuration,
  getContestCountryCode: mocks.getContestCountryCode,
  updateLeagueEventConfig: mocks.updateLeagueEventConfig,
  cancelEvent: mocks.cancelEvent,
}))

import { LeagueDomainError } from "@/lib/league/definitions"
import { AuthorizationError } from "@/lib/services/profile/authorization"
import { GET as listRoute, POST as createRoute } from "./route"
import { GET as getRoute, PATCH as patchRoute } from "./[id]/route"
import { POST as visibilityRoute } from "./[id]/visibility/route"
import { POST as cancelRoute } from "./[id]/cancel/route"

const CURATOR = { id: "curator-1", email: "c@example.com" }
const KEY = "8b1f0b1e-9c0d-4a5e-b2f3-aabbccddeeff"
const ctx = { params: Promise.resolve({ id: "e1" }) }

function json(path: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const contest = {
  name: "City Open",
  sports: ["Skateboard"],
  startDate: "2026-12-01",
  city: "Lisbon",
  country: "Portugal",
  countryCode: "PT",
  timezone: "Europe/Lisbon",
  category: "championship",
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.resolveScopeCountryCode.mockImplementation(
    async (input: { countryCode?: string }) => input.countryCode ?? "PT",
  )
  mocks.requireContestCurationAccess.mockResolvedValue(CURATOR)
  mocks.getContestCountryCode.mockResolvedValue("PT")
})

describe("POST /api/admin/league/contests", () => {
  it("creates a comped curated contest in the curator's scope", async () => {
    mocks.createLeagueEvent.mockResolvedValue({ id: "e1", version: 0, slug: "city-open-1" })
    const response = await createRoute(
      json("/api/admin/league/contests", {
        idempotencyKey: KEY,
        contest,
        planSlug: "starter",
        visibility: "public",
        featured: true,
      }),
    )
    expect(response.status).toBe(201)
    expect(mocks.requireContestCurationAccess).toHaveBeenCalledWith("PT", "league.curate")
    expect(mocks.createLeagueEvent).toHaveBeenCalledWith(
      CURATOR.id,
      expect.objectContaining({ name: "City Open" }),
      {
        idempotencyKey: KEY,
        curator: { planSlug: "starter", visibility: "public", featured: true },
      },
    )
  })

  it("rejects a country outside the curator's scope", async () => {
    mocks.requireContestCurationAccess.mockRejectedValue(
      new AuthorizationError("FORBIDDEN", "Missing contest curation scope"),
    )
    const response = await createRoute(
      json("/api/admin/league/contests", { idempotencyKey: KEY, contest, planSlug: "pro" }),
    )
    expect(response.status).toBe(403)
    expect(mocks.createLeagueEvent).not.toHaveBeenCalled()
  })

  it("validates the body before checking scope", async () => {
    const response = await createRoute(
      json("/api/admin/league/contests", { idempotencyKey: KEY, contest: { name: "" } }),
    )
    expect(response.status).toBe(400)
    expect(mocks.requireContestCurationAccess).not.toHaveBeenCalled()
  })
})

describe("GET /api/admin/league/contests", () => {
  it("lists every country for admins and the scoped countries for curators", async () => {
    mocks.listContestsForCuration.mockResolvedValue([])
    mocks.getServerUserFromCookies.mockResolvedValue({
      id: "a1",
      isAdministrator: true,
      canCurateContests: true,
      curatedCountryCodes: [],
    })
    await listRoute(new NextRequest("http://localhost/api/admin/league/contests?visibility=public&featured=true"))
    expect(mocks.listContestsForCuration).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ visibility: "public", featured: true }),
    )

    mocks.getServerUserFromCookies.mockResolvedValue({
      id: "c1",
      isAdministrator: false,
      canCurateContests: true,
      curatedCountryCodes: ["PT", "ES"],
    })
    await listRoute(new NextRequest("http://localhost/api/admin/league/contests"))
    expect(mocks.listContestsForCuration).toHaveBeenLastCalledWith(["PT", "ES"], expect.any(Object))
  })

  it("forbids users without league.curate", async () => {
    mocks.getServerUserFromCookies.mockResolvedValue({
      id: "u1",
      isAdministrator: false,
      canCurateContests: false,
    })
    const response = await listRoute(new NextRequest("http://localhost/api/admin/league/contests"))
    expect(response.status).toBe(403)
  })
})

describe("contest moderation", () => {
  it("404s contests that do not exist", async () => {
    mocks.getContestCountryCode.mockResolvedValue(null)
    const response = await getRoute(new NextRequest("http://localhost/x"), ctx)
    expect(response.status).toBe(404)
  })

  it("patches as curator with the moderation reason", async () => {
    mocks.updateLeagueEventConfig.mockResolvedValue({ id: "e1", version: 5 })
    const response = await patchRoute(
      json(
        "/api/admin/league/contests/e1",
        { expectedVersion: 4, idempotencyKey: KEY, patch: { featured: true, name: "Fixed" }, reason: "typo" },
        "PATCH",
      ),
      ctx,
    )
    expect(response.status).toBe(200)
    expect(mocks.updateLeagueEventConfig).toHaveBeenCalledWith(
      CURATOR.id,
      expect.objectContaining({ eventId: "e1", patch: { featured: true, name: "Fixed" } }),
      { asCurator: true, reason: "typo" },
    )
  })

  it("needs scope in the target country when moving a contest", async () => {
    mocks.requireContestCurationAccess
      .mockResolvedValueOnce(CURATOR)
      .mockRejectedValueOnce(new AuthorizationError("FORBIDDEN", "no scope"))
    const response = await patchRoute(
      json(
        "/api/admin/league/contests/e1",
        { expectedVersion: 4, idempotencyKey: KEY, patch: { countryCode: "FR" } },
        "PATCH",
      ),
      ctx,
    )
    expect(response.status).toBe(403)
    expect(mocks.requireContestCurationAccess).toHaveBeenLastCalledWith("FR", "league.curate")
    expect(mocks.updateLeagueEventConfig).not.toHaveBeenCalled()
  })

  it("hides a contest and maps the paid-plan rule when listing it", async () => {
    mocks.updateLeagueEventConfig.mockResolvedValueOnce({ id: "e1", version: 6 })
    const hidden = await visibilityRoute(
      json("/x", { expectedVersion: 5, idempotencyKey: KEY, visibility: "unlisted" }),
      ctx,
    )
    expect(hidden.status).toBe(200)
    expect(mocks.updateLeagueEventConfig).toHaveBeenLastCalledWith(
      CURATOR.id,
      expect.objectContaining({ patch: { visibility: "unlisted" } }),
      { asCurator: true, reason: undefined },
    )

    mocks.updateLeagueEventConfig.mockRejectedValueOnce(
      new LeagueDomainError("VISIBILITY_REQUIRES_PAID_PLAN", "paid only"),
    )
    const listed = await visibilityRoute(
      json("/x", { expectedVersion: 6, idempotencyKey: KEY, visibility: "public" }),
      ctx,
    )
    expect(listed.status).toBe(403)
  })

  it("cancels through the lifecycle writer as curator", async () => {
    mocks.cancelEvent.mockResolvedValue({ id: "e1", version: 7 })
    const response = await cancelRoute(
      json("/x", { expectedVersion: 6, idempotencyKey: KEY, reason: "spam" }),
      ctx,
    )
    expect(response.status).toBe(200)
    expect(mocks.cancelEvent).toHaveBeenCalledWith(
      CURATOR.id,
      { eventId: "e1", expectedVersion: 6, idempotencyKey: KEY },
      { asCurator: true, reason: "spam" },
    )
  })
})
