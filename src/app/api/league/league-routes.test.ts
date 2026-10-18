/**
 * League route contract tests — services mocked (repo pattern from
 * admin/events route tests); the real DB is never touched. Covers auth
 * gating, body validation, domain-error → status mapping (409 gate, 503
 * transient), idempotency/OCC pass-through and the `{id, version}` envelope.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const getSessionUserMock = vi.hoisted(() => vi.fn())

const serviceMocks = vi.hoisted(() => ({
  createLeagueEvent: vi.fn(),
  listMyLeagueEvents: vi.fn(),
  getLeagueEventState: vi.fn(),
  getLeagueEventVersion: vi.fn(),
  updateLeagueEventConfig: vi.fn(),
  registerEventPayment: vi.fn(),
  markLeaguePayment: vi.fn(),
  generateEventSchedule: vi.fn(),
  reorderEventSchedule: vi.fn(),
  setRunWindow: vi.fn(),
  submitRunScore: vi.fn(),
  joinEventByCode: vi.fn(),
  getInvitePreview: vi.fn(),
  getLeagueEventDashboard: vi.fn(),
  getMyEventHistory: vi.fn(),
  cancelEvent: vi.fn(),
  completeEvent: vi.fn(),
  startEvent: vi.fn(),
  openEventRegistration: vi.fn(),
  closeEventRegistration: vi.fn(),
  publishEventResults: vi.fn(),
  createEventInvite: vi.fn(),
  revokeEventInvite: vi.fn(),
  leaveEvent: vi.fn(),
  addEventMember: vi.fn(),
  listEventMembers: vi.fn(),
  removeEventMember: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  getEmailDigestsEnabled: vi.fn(),
  setEmailDigests: vi.fn(),
  isEmailDeliveryAvailable: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUserMock(...args),
}))

vi.mock("@/lib/services/league", () => ({
  createLeagueEvent: serviceMocks.createLeagueEvent,
  listMyLeagueEvents: serviceMocks.listMyLeagueEvents,
  getLeagueEventState: serviceMocks.getLeagueEventState,
  getLeagueEventVersion: serviceMocks.getLeagueEventVersion,
  updateLeagueEventConfig: serviceMocks.updateLeagueEventConfig,
  registerEventPayment: serviceMocks.registerEventPayment,
  markLeaguePayment: serviceMocks.markLeaguePayment,
  generateEventSchedule: serviceMocks.generateEventSchedule,
  reorderEventSchedule: serviceMocks.reorderEventSchedule,
  setRunWindow: serviceMocks.setRunWindow,
  submitRunScore: serviceMocks.submitRunScore,
  joinEventByCode: serviceMocks.joinEventByCode,
  getInvitePreview: serviceMocks.getInvitePreview,
  getLeagueEventDashboard: serviceMocks.getLeagueEventDashboard,
  getMyEventHistory: serviceMocks.getMyEventHistory,
  cancelEvent: serviceMocks.cancelEvent,
  completeEvent: serviceMocks.completeEvent,
  startEvent: serviceMocks.startEvent,
  openEventRegistration: serviceMocks.openEventRegistration,
  closeEventRegistration: serviceMocks.closeEventRegistration,
  publishEventResults: serviceMocks.publishEventResults,
  createEventInvite: serviceMocks.createEventInvite,
  revokeEventInvite: serviceMocks.revokeEventInvite,
  leaveEvent: serviceMocks.leaveEvent,
  addEventMember: serviceMocks.addEventMember,
  listEventMembers: serviceMocks.listEventMembers,
  removeEventMember: serviceMocks.removeEventMember,
}))

vi.mock("@/lib/notifications/service", () => ({
  listNotifications: serviceMocks.listNotifications,
  markNotificationsRead: serviceMocks.markNotificationsRead,
  getEmailDigestsEnabled: serviceMocks.getEmailDigestsEnabled,
  setEmailDigests: serviceMocks.setEmailDigests,
  isEmailDeliveryAvailable: serviceMocks.isEmailDeliveryAvailable,
}))

vi.mock("@/app/api/league/rate-limit", () => ({
  enforceLeagueRateLimit: vi.fn(),
}))

import { LeagueDomainError } from "@/lib/league/definitions"
import { TimeoutError } from "@/lib/db/client"

import { POST as postCreate, GET as getMyEvents } from "./events/route"
import { GET as getEventState, PATCH as patchEventConfig } from "./events/[id]/route"
import { POST as postPayment } from "./events/[id]/payment/route"
import { POST as postSchedule, PATCH as patchSchedule } from "./events/[id]/schedule/route"
import { POST as postWindow } from "./events/[id]/runs/[runId]/window/route"
import { POST as postScore } from "./events/[id]/runs/[runId]/scores/route"
import { POST as postJoin } from "./join/route"
import { GET as getInvitePreviewRoute } from "./invites/[code]/route"
import { GET as getDashboard } from "./events/[id]/dashboard/route"
import { GET as getHistory } from "./events/[id]/history/route"
import { POST as postCancel } from "./events/[id]/cancel/route"
import { POST as postComplete } from "./events/[id]/complete/route"
import { POST as postStart } from "./events/[id]/start/route"
import { POST as postRegistrationOpen } from "./events/[id]/registration/open/route"
import { POST as postRegistrationClose } from "./events/[id]/registration/close/route"
import { POST as postResultsPublish } from "./events/[id]/results/publish/route"
import { POST as postInvites } from "./events/[id]/invites/route"
import { DELETE as deleteInvite } from "./events/[id]/invites/[inviteId]/route"
import { POST as postLeave } from "./events/[id]/leave/route"
import { GET as getMembers, POST as postMembers } from "./events/[id]/members/route"
import { DELETE as deleteMember } from "./events/[id]/members/[membershipId]/route"
import { GET as getNotifications, } from "@/app/api/notifications/route"
import { POST as postNotificationsRead } from "@/app/api/notifications/read/route"
import {
  GET as getEmailPreferences,
  PUT as putEmailPreferences,
} from "@/app/api/notifications/email-preferences/route"

const USER = { id: "user-1", email: "rider@example.com" }

function jsonRequest(
  path: string,
  body?: unknown,
  method = "POST",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}

const validBody = {
  expectedVersion: 3,
  idempotencyKey: "8b1f0b1e-9c0d-4a5e-b2f3-aabbccddeeff",
}

beforeEach(() => {
  getSessionUserMock.mockReset()
  for (const mock of Object.values(serviceMocks)) mock.mockReset()
  getSessionUserMock.mockResolvedValue(USER)
})

describe("auth gating", () => {
  it("returns 401 bare for every mutation/private read without a session", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const responses = await Promise.all([
      postCreate(jsonRequest("/api/league/events", {})),
      getMyEvents(),
      getEventState(
        new NextRequest("http://localhost/api/league/events/e1"),
        routeContext({ id: "e1" }),
      ),
      patchEventConfig(
        jsonRequest("/api/league/events/e1", validBody, "PATCH"),
        routeContext({ id: "e1" }),
      ),
      postPayment(jsonRequest("/api/league/events/e1/payment", validBody), routeContext({ id: "e1" })),
      postSchedule(jsonRequest("/api/league/events/e1/schedule", validBody), routeContext({ id: "e1" })),
      postWindow(
        jsonRequest("/api/league/events/e1/runs/r1/window", validBody),
        routeContext({ id: "e1", runId: "r1" }),
      ),
      postScore(
        jsonRequest("/api/league/events/e1/runs/r1/scores", { ...validBody, scores: {} }),
        routeContext({ id: "e1", runId: "r1" }),
      ),
      postJoin(jsonRequest("/api/league/join", { code: "abcdefgh1234" })),
      postCancel(jsonRequest("/api/league/events/e1/cancel", validBody), routeContext({ id: "e1" })),
      postComplete(jsonRequest("/api/league/events/e1/complete", validBody), routeContext({ id: "e1" })),
      postStart(jsonRequest("/api/league/events/e1/start", validBody), routeContext({ id: "e1" })),
      postRegistrationOpen(jsonRequest("/api/league/events/e1/registration/open", validBody), routeContext({ id: "e1" })),
      postRegistrationClose(jsonRequest("/api/league/events/e1/registration/close", validBody), routeContext({ id: "e1" })),
      postResultsPublish(jsonRequest("/api/league/events/e1/results/publish", validBody), routeContext({ id: "e1" })),
      postInvites(jsonRequest("/api/league/events/e1/invites", validBody), routeContext({ id: "e1" })),
      deleteInvite(jsonRequest("/api/league/events/e1/invites/i1", validBody, "DELETE"), routeContext({ id: "e1", inviteId: "i1" })),
      postLeave(jsonRequest("/api/league/events/e1/leave", { idempotencyKey: validBody.idempotencyKey }), routeContext({ id: "e1" })),
      getMembers(new NextRequest("http://localhost/api/league/events/e1/members"), routeContext({ id: "e1" })),
      postMembers(jsonRequest("/api/league/events/e1/members", validBody), routeContext({ id: "e1" })),
      deleteMember(jsonRequest("/api/league/events/e1/members/m1", validBody, "DELETE"), routeContext({ id: "e1", membershipId: "m1" })),
      getDashboard(new NextRequest("http://localhost/api/league/events/e1/dashboard"), routeContext({ id: "e1" })),
      getHistory(new NextRequest("http://localhost/api/league/events/e1/history"), routeContext({ id: "e1" })),
      getNotifications(new NextRequest("http://localhost/api/notifications")),
      putEmailPreferences(jsonRequest("/api/notifications/email-preferences", { emailDigests: true }, "PUT")),
    ])
    for (const response of responses) {
      expect(response.status).toBe(401)
    }
  })

  it("maps NOT_AUTHORIZED to 403", async () => {
    serviceMocks.cancelEvent.mockRejectedValue(
      new LeagueDomainError("NOT_AUTHORIZED", "You are not authorized for this action"),
    )
    const response = await postCancel(
      jsonRequest("/api/league/events/e1/cancel", validBody),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe("NOT_AUTHORIZED")
  })

  it("maps RATE_LIMITED to 429", async () => {
    const { enforceLeagueRateLimit } = await import("@/app/api/league/rate-limit")
    vi.mocked(enforceLeagueRateLimit).mockImplementationOnce(() => {
      throw new LeagueDomainError("RATE_LIMITED", "Too many requests")
    })
    const response = await postJoin(jsonRequest("/api/league/join", { code: "abcdefgh1234" }))
    expect(response.status).toBe(429)
    expect((await response.json()).error).toBe("RATE_LIMITED")
  })
})

describe("create + list", () => {
  it("creates an event → 201 {id, version}", async () => {
    serviceMocks.createLeagueEvent.mockResolvedValue({ id: "e1", version: 0 })
    const response = await postCreate(
      jsonRequest("/api/league/events", {
        name: "Night Jam",
        description: "",
        sports: ["Skateboard"],
        startDate: "2026-10-01",
        city: "Barcelona",
        country: "Spain",
        countryCode: "ES",
        timezone: "UTC",
        category: "local-event",
      }),
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: "e1", version: 0 })
  })

  it("maps QUOTA_EXCEEDED to 409 with the typed code", async () => {
    serviceMocks.createLeagueEvent.mockRejectedValue(
      new LeagueDomainError("QUOTA_EXCEEDED", "limit reached"),
    )
    const response = await postCreate(
      jsonRequest("/api/league/events", {
        name: "Night Jam",
        description: "",
        sports: ["Skateboard"],
        startDate: "2026-10-01",
        city: "Barcelona",
        country: "Spain",
        countryCode: "ES",
        timezone: "UTC",
        category: "local-event",
      }),
    )
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("QUOTA_EXCEEDED")
  })

  it("rejects invalid bodies with 400 + details", async () => {
    const response = await postCreate(jsonRequest("/api/league/events", { name: "" }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Invalid body")
    expect(body.details).toBeDefined()
  })

  it("takes the idempotency key from the body, not the fingerprint", async () => {
    serviceMocks.createLeagueEvent.mockResolvedValue({ id: "e1", version: 0 })
    const bodyIdempotencyKey = "8b1f0b1e-9c0d-4a5e-b2f3-aabbccddeeff"
    const response = await postCreate(
      jsonRequest("/api/league/events", {
        idempotencyKey: bodyIdempotencyKey,
        name: "Night Jam",
        description: "",
        sports: ["Skateboard"],
        startDate: "2026-10-01",
        city: "Barcelona",
        country: "Spain",
        countryCode: "ES",
        timezone: "UTC",
        category: "local-event",
      }),
    )
    expect(response.status).toBe(201)
    expect(serviceMocks.createLeagueEvent).toHaveBeenCalledWith(
      USER.id,
      expect.not.objectContaining({ idempotencyKey: bodyIdempotencyKey }),
      { idempotencyKey: bodyIdempotencyKey, ip: "unknown" },
    )
  })

  it("lists my events for the signed-in user", async () => {
    serviceMocks.listMyLeagueEvents.mockResolvedValue([{ id: "e1" }])
    const response = await getMyEvents()
    expect(response.status).toBe(200)
    expect((await response.json()).items).toEqual([{ id: "e1" }])
  })
})

describe("state + config patch", () => {
  it("returns the state with an ETag derived from version", async () => {
    serviceMocks.getLeagueEventState.mockResolvedValue({
      event: { id: "e1", version: 7 },
      myRole: "rider",
    })
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/e1"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("ETag")).toBe('"event-e1-7"')
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
  })

  it("returns 404 when the state is missing", async () => {
    serviceMocks.getLeagueEventState.mockResolvedValue(null)
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/nope"),
      routeContext({ id: "nope" }),
    )
    expect(response.status).toBe(404)
  })

  it("returns 304 when ?version= matches the current version", async () => {
    serviceMocks.getLeagueEventVersion.mockResolvedValue(7)
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/e1?version=7"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(304)
    expect(response.headers.get("ETag")).toBe('"event-e1-7"')
    expect(serviceMocks.getLeagueEventState).not.toHaveBeenCalled()
  })

  it("honors If-None-Match for the 304 short-circuit", async () => {
    serviceMocks.getLeagueEventVersion.mockResolvedValue(7)
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/e1", {
        headers: { "If-None-Match": '"event-e1-7"' },
      }),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(304)
  })

  it("refetches when ?version= is stale", async () => {
    serviceMocks.getLeagueEventVersion.mockResolvedValue(9)
    serviceMocks.getLeagueEventState.mockResolvedValue({
      event: { id: "e1", version: 9 },
      myRole: "rider",
    })
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/e1?version=7"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.getLeagueEventState).toHaveBeenCalled()
  })

  it("rejects non-integer versions with 400", async () => {
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/e1?version=abc"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(400)
  })

  it("forwards expectedVersion + idempotencyKey on PATCH", async () => {
    serviceMocks.updateLeagueEventConfig.mockResolvedValue({ id: "e1", version: 8 })
    const response = await patchEventConfig(
      jsonRequest("/api/league/events/e1", { ...validBody, patch: { name: "New" } }, "PATCH"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "e1", version: 8 })
    expect(serviceMocks.updateLeagueEventConfig).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({
        eventId: "e1",
        expectedVersion: 3,
        idempotencyKey: validBody.idempotencyKey,
      }),
    )
  })
})

describe("payment + schedule + runs", () => {
  it("registers a payment and returns {id, version}", async () => {
    serviceMocks.registerEventPayment.mockResolvedValue({ id: "e1", version: 9 })
    const response = await postPayment(
      jsonRequest("/api/league/events/e1/payment", { ...validBody, planSlug: "starter" }),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "e1", version: 9 })
  })

  it("surfaces EVENT_LOCKED as 409 on schedule generation", async () => {
    serviceMocks.generateEventSchedule.mockRejectedValue(
      new LeagueDomainError(
        "EVENT_LOCKED",
        "Payment required to move forward: the event is read-only until a payment is registered",
      ),
    )
    const response = await postSchedule(
      jsonRequest("/api/league/events/e1/schedule", validBody),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("EVENT_LOCKED")
  })

  it("reorders runs via PATCH and passes slot + order through", async () => {
    serviceMocks.reorderEventSchedule.mockResolvedValue({ id: "e1", version: 13 })
    const response = await patchSchedule(
      jsonRequest(
        "/api/league/events/e1/schedule",
        {
          ...validBody,
          slotMinutes: 15,
          runs: [
            { runId: "r2", sequence: 1 },
            { runId: "r1", sequence: 2 },
          ],
        },
        "PATCH",
      ),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "e1", version: 13 })
    expect(serviceMocks.reorderEventSchedule).toHaveBeenCalledWith(USER.id, {
      eventId: "e1",
      expectedVersion: 3,
      idempotencyKey: validBody.idempotencyKey,
      slotMinutes: 15,
      runs: [
        { runId: "r2", sequence: 1 },
        { runId: "r1", sequence: 2 },
      ],
    })
  })

  it("rejects duplicate reorder sequences with 400 at the schema", async () => {
    const response = await patchSchedule(
      jsonRequest(
        "/api/league/events/e1/schedule",
        {
          ...validBody,
          runs: [
            { runId: "r1", sequence: 1 },
            { runId: "r2", sequence: 1 },
          ],
        },
        "PATCH",
      ),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(400)
  })

  it("maps run window + score actions to the service", async () => {
    serviceMocks.setRunWindow.mockResolvedValue({ id: "e1", version: 10 })
    serviceMocks.submitRunScore.mockResolvedValue({ id: "e1", version: 11 })
    const windowResponse = await postWindow(
      jsonRequest("/api/league/events/e1/runs/r1/window", {
        ...validBody,
        mode: "open",
        windowMinutes: 10,
      }),
      routeContext({ id: "e1", runId: "r1" }),
    )
    expect(windowResponse.status).toBe(200)
    expect(serviceMocks.setRunWindow).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ runId: "r1", mode: "open", windowMinutes: 10 }),
    )
    const scoreResponse = await postScore(
      jsonRequest("/api/league/events/e1/runs/r1/scores", {
        ...validBody,
        scores: { style: 8, consistency: 7, amplitude: 9, technique: 8 },
      }),
      routeContext({ id: "e1", runId: "r1" }),
    )
    expect(scoreResponse.status).toBe(200)
    expect(serviceMocks.submitRunScore).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ runId: "r1" }),
    )
  })

  it("rejects score payloads below the schema floor", async () => {
    const response = await postScore(
      jsonRequest("/api/league/events/e1/runs/r1/scores", {
        ...validBody,
        scores: { style: -1 },
      }),
      routeContext({ id: "e1", runId: "r1" }),
    )
    expect(response.status).toBe(400)
  })
})

describe("join + invite preview", () => {
  it("joins by code → 201 with role", async () => {
    serviceMocks.joinEventByCode.mockResolvedValue({
      id: "e1",
      version: 12,
      role: "rider",
      eventSlug: "night-jam",
    })
    const response = await postJoin(jsonRequest("/api/league/join", { code: "abcdefgh1234" }))
    expect(response.status).toBe(201)
    expect((await response.json()).role).toBe("rider")
  })

  it("takes the join idempotency key from the body", async () => {
    serviceMocks.joinEventByCode.mockResolvedValue({
      id: "e1",
      version: 12,
      role: "rider",
      eventSlug: "night-jam",
    })
    const bodyIdempotencyKey = "8b1f0b1e-9c0d-4a5e-b2f3-aabbccddeeff"
    const response = await postJoin(
      jsonRequest("/api/league/join", {
        code: "abcdefgh1234",
        idempotencyKey: bodyIdempotencyKey,
      }),
    )
    expect(response.status).toBe(201)
    expect(serviceMocks.joinEventByCode).toHaveBeenCalledWith(
      USER.id,
      "abcdefgh1234",
      { idempotencyKey: bodyIdempotencyKey },
    )
  })

  it("maps INVITE_EXHAUSTED to 409", async () => {
    serviceMocks.joinEventByCode.mockRejectedValue(
      new LeagueDomainError("INVITE_EXHAUSTED", "This invite reached its usage limit"),
    )
    const response = await postJoin(jsonRequest("/api/league/join", { code: "abcdefgh1234" }))
    expect(response.status).toBe(409)
  })

  it("previews an invite without a session", async () => {
    getSessionUserMock.mockResolvedValue(null)
    serviceMocks.getInvitePreview.mockResolvedValue({
      eventSlug: "night-jam",
      eventName: "Night Jam",
      usable: true,
      reason: null,
    })
    const response = await getInvitePreviewRoute(
      new NextRequest("http://localhost/api/league/invites/abcdefgh1234"),
      routeContext({ code: "abcdefgh1234" }),
    )
    expect(response.status).toBe(200)
    expect((await response.json()).usable).toBe(true)
  })

  it("404s unknown invite codes", async () => {
    serviceMocks.getInvitePreview.mockResolvedValue(null)
    const response = await getInvitePreviewRoute(
      new NextRequest("http://localhost/api/league/invites/nope123"),
      routeContext({ code: "nope123" }),
    )
    expect(response.status).toBe(404)
  })
})

describe("notifications", () => {
  it("lists with pagination params", async () => {
    serviceMocks.listNotifications.mockResolvedValue({ items: [], unreadCount: 0, nextCursor: null })
    const response = await getNotifications(
      new NextRequest("http://localhost/api/notifications?limit=5&unread=1"),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.listNotifications).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ limit: 5, unreadOnly: true }),
    )
  })

  it("marks read (all) and returns the count", async () => {
    serviceMocks.markNotificationsRead.mockResolvedValue({ updated: 4 })
    const response = await postNotificationsRead(
      jsonRequest("/api/notifications/read", { all: true }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ updated: 4 })
    expect(serviceMocks.markNotificationsRead).toHaveBeenCalledWith(USER.id, { all: true })
  })

  it("rejects read payloads without ids/all", async () => {
    const response = await postNotificationsRead(
      jsonRequest("/api/notifications/read", {}),
    )
    expect(response.status).toBe(400)
  })
})

describe("email preferences", () => {
  it("returns the digest preference + delivery detection for the signed-in user", async () => {
    serviceMocks.getEmailDigestsEnabled.mockResolvedValue({ emailDigests: true })
    serviceMocks.isEmailDeliveryAvailable.mockResolvedValue(false)
    const response = await getEmailPreferences()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      emailDigests: true,
      deliveryAvailable: false,
    })
    expect(serviceMocks.getEmailDigestsEnabled).toHaveBeenCalledWith(USER.id)
    expect(serviceMocks.isEmailDeliveryAvailable).toHaveBeenCalledTimes(1)
  })

  it("401s without a session", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const response = await getEmailPreferences()
    expect(response.status).toBe(401)
  })

  it("saves via PUT and echoes the value", async () => {
    serviceMocks.setEmailDigests.mockResolvedValue({ emailDigests: false })
    const response = await putEmailPreferences(
      jsonRequest("/api/notifications/email-preferences", { emailDigests: false }, "PUT"),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ emailDigests: false })
    expect(serviceMocks.setEmailDigests).toHaveBeenCalledWith(USER.id, false)
  })

  it("rejects non-boolean payloads with 400", async () => {
    const response = await putEmailPreferences(
      jsonRequest("/api/notifications/email-preferences", { emailDigests: "yes" }, "PUT"),
    )
    expect(response.status).toBe(400)
  })
})

describe("dashboard + history", () => {
  it("returns dashboard metrics for the organizer", async () => {
    serviceMocks.getLeagueEventDashboard.mockResolvedValue({
      eventStatus: "live",
      counts: { riders: 3, judges: 1, organizers: 1 },
      runs: { total: 3, scored: 1, skipped: 0, judging: 1 },
      judges: [],
      criteria: [],
      payment: { state: "paid", planSlug: "free" },
      historicMetrics: false,
    })
    const response = await getDashboard(
      new NextRequest("http://localhost/api/league/events/e1/dashboard"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.getLeagueEventDashboard).toHaveBeenCalledWith("e1", USER.id)
  })

  it("404s the dashboard for non-organizers (presence not disclosed)", async () => {
    serviceMocks.getLeagueEventDashboard.mockResolvedValue(null)
    const response = await getDashboard(
      new NextRequest("http://localhost/api/league/events/e1/dashboard"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(404)
  })

  it("returns history for the signed-in member", async () => {
    serviceMocks.getMyEventHistory.mockResolvedValue({
      eventStatus: "completed",
      myRole: "rider",
      myRuns: [],
      result: { rank: 2, totalScore: 88.5, pointsAwarded: 40 },
      myJudgements: [],
    })
    const response = await getHistory(
      new NextRequest("http://localhost/api/league/events/e1/history"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.getMyEventHistory).toHaveBeenCalledWith("e1", USER.id)
  })

  it("404s history for non-members", async () => {
    serviceMocks.getMyEventHistory.mockResolvedValue(null)
    const response = await getHistory(
      new NextRequest("http://localhost/api/league/events/e1/history"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(404)
  })
})

describe("transient failures", () => {
  it("maps TimeoutError to 503 with a generic message", async () => {
    serviceMocks.getLeagueEventState.mockRejectedValue(new TimeoutError(15_000))
    const response = await getEventState(
      new NextRequest("http://localhost/api/league/events/e1"),
      routeContext({ id: "e1" }),
    )
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error).toBe("SERVICE_UNAVAILABLE")
    expect(body.message).not.toContain("db deadline")
  })
})
