/**
 * Admin league route contract tests — services mocked, the real DB is never
 * touched (pattern from admin/regions route tests). Covers `league.manage`
 * gating, validation, and pass-through to the plan / account-plan services.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { LeagueDomainError } from "@/lib/league/definitions"

const requireCurationAccessMock = vi.fn()
const serviceMocks = {
  listEventPlans: vi.fn(),
  createEventPlan: vi.fn(),
  updateEventPlan: vi.fn(),
  listAccountPlans: vi.fn(),
  grantAccountPlan: vi.fn(),
  revokeAccountPlan: vi.fn(),
  listLeaguePayments: vi.fn(),
  markLeaguePayment: vi.fn(),
}

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "UNAUTHENTICATED" ? 401 : 403,
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: (...args: unknown[]) =>
    requireCurationAccessMock(...args),
  authorizationErrorResponse,
}))

vi.mock("@/lib/services/profile/authorization", () => ({
  isAuthorizationError: (error: unknown) =>
    error instanceof Error && error.message === "UNAUTHENTICATED",
}))

vi.mock("@/lib/services/league", () => ({
  listEventPlans: (...args: unknown[]) => serviceMocks.listEventPlans(...args),
  createEventPlan: (...args: unknown[]) => serviceMocks.createEventPlan(...args),
  updateEventPlan: (...args: unknown[]) => serviceMocks.updateEventPlan(...args),
  listAccountPlans: (...args: unknown[]) => serviceMocks.listAccountPlans(...args),
  grantAccountPlan: (...args: unknown[]) => serviceMocks.grantAccountPlan(...args),
  revokeAccountPlan: (...args: unknown[]) => serviceMocks.revokeAccountPlan(...args),
  listLeaguePayments: (...args: unknown[]) =>
    serviceMocks.listLeaguePayments(...args),
  markLeaguePayment: (...args: unknown[]) =>
    serviceMocks.markLeaguePayment(...args),
}))

const plansRoute = await import("./plans/route")
const planSlugRoute = await import("./plans/[slug]/route")
const accountPlansRoute = await import("./account-plans/route")
const paymentsRoute = await import("./payments/route")
const paymentIdRoute = await import("./payments/[id]/route")

const ADMIN = { id: "admin-1", email: "admin@example.com" }

function jsonRequest(path: string, body?: unknown, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}

const planItem = {
  slug: "free",
  name: "Free",
  description: "",
  priceCents: 0,
  currency: "USD",
  maxRiders: 3,
  maxJudges: 0,
  maxOrganizers: 1,
  monthlyEventLimit: 8,
  isDefault: true,
  active: true,
  sortOrder: 0,
}

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue(ADMIN)
  serviceMocks.listEventPlans.mockResolvedValue([planItem])
  serviceMocks.createEventPlan.mockResolvedValue(planItem)
  serviceMocks.updateEventPlan.mockResolvedValue(planItem)
  serviceMocks.listAccountPlans.mockResolvedValue([])
  serviceMocks.grantAccountPlan.mockResolvedValue({
    userId: "user-2",
    displayName: "User user-2",
    email: "user@example.com",
    planSlug: "pro",
    source: "admin_grant",
    status: "active",
    grantedAt: "2026-09-13T00:00:00.000Z",
  })
  serviceMocks.revokeAccountPlan.mockResolvedValue({
    userId: "user-2",
    status: "revoked",
  })
})

describe("plans gating", () => {
  it("GET requires league.manage", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("UNAUTHENTICATED"))
    const response = await plansRoute.GET()
    expect(response.status).toBe(401)
    expect(serviceMocks.listEventPlans).not.toHaveBeenCalled()
  })

  it("POST requires league.manage", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("UNAUTHENTICATED"))
    const response = await plansRoute.POST(
      jsonRequest("/api/admin/league/plans", { slug: "pro", name: "Pro" }, "POST"),
    )
    expect(response.status).toBe(401)
  })
})

describe("plans read + create", () => {
  it("lists plans", async () => {
    const response = await plansRoute.GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].slug).toBe("free")
  })

  it("creates a plan with the actor recorded", async () => {
    const response = await plansRoute.POST(
      jsonRequest(
        "/api/admin/league/plans",
        { slug: "starter-plus", name: "Starter Plus", priceCents: 900, maxRiders: 21 },
        "POST",
      ),
    )
    expect(response.status).toBe(201)
    expect(serviceMocks.createEventPlan).toHaveBeenCalledWith(
      ADMIN.id,
      expect.objectContaining({ slug: "starter-plus" }),
    )
  })

  it("rejects invalid slugs with 400", async () => {
    const response = await plansRoute.POST(
      jsonRequest(
        "/api/admin/league/plans",
        { slug: "Bad_Slug", name: "X" },
        "POST",
      ),
    )
    expect(response.status).toBe(400)
  })
})

describe("plan patch", () => {
  it("forwards the patch + actor to the service", async () => {
    const response = await planSlugRoute.PATCH(
      jsonRequest(
        "/api/admin/league/plans/free",
        { priceCents: 500, isDefault: true },
        "PATCH",
      ),
      routeContext({ slug: "free" }),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.updateEventPlan).toHaveBeenCalledWith(
      ADMIN.id,
      "free",
      expect.objectContaining({ priceCents: 500 }),
    )
  })

  it("rejects empty patches with 400", async () => {
    const response = await planSlugRoute.PATCH(
      jsonRequest("/api/admin/league/plans/free", {}, "PATCH"),
      routeContext({ slug: "free" }),
    )
    expect(response.status).toBe(400)
  })
})

describe("account plans", () => {
  it("searches with the query param", async () => {
    const request = new NextRequest(
      "http://localhost/api/admin/league/account-plans?search=rider",
    )
    const response = await accountPlansRoute.GET(request)
    expect(response.status).toBe(200)
    expect(serviceMocks.listAccountPlans).toHaveBeenCalledWith({ search: "rider" })
  })

  it("grants a plan with the actor recorded", async () => {
    const response = await accountPlansRoute.PATCH(
      jsonRequest(
        "/api/admin/league/account-plans",
        { userId: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a", planSlug: "pro" },
        "PATCH",
      ),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.grantAccountPlan).toHaveBeenCalledWith(
      ADMIN.id,
      { userId: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a", planSlug: "pro" },
    )
  })

  it("revokes without a planSlug", async () => {
    const response = await accountPlansRoute.PATCH(
      jsonRequest(
        "/api/admin/league/account-plans",
        { userId: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a", action: "revoke" },
        "PATCH",
      ),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.revokeAccountPlan).toHaveBeenCalledWith(
      "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
    )
  })

  it("rejects grant without planSlug with 400", async () => {
    const response = await accountPlansRoute.PATCH(
      jsonRequest(
        "/api/admin/league/account-plans",
        { userId: "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a" },
        "PATCH",
      ),
    )
    expect(response.status).toBe(400)
  })
})

describe("payments queue + transitions", () => {
  const paymentItem = {
    id: "pay-1",
    eventId: "e1",
    planSlug: "starter",
    status: "pending",
    amountCents: 500,
    payerName: "Rider",
    eventName: "Night Jam",
  }

  it("GET requires league.manage", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("UNAUTHENTICATED"))
    const response = await paymentsRoute.GET(
      jsonRequest("/api/admin/league/payments"),
    )
    expect(response.status).toBe(401)
    expect(serviceMocks.listLeaguePayments).not.toHaveBeenCalled()
  })

  it("GET lists payments and passes a valid status filter", async () => {
    serviceMocks.listLeaguePayments.mockResolvedValue([paymentItem])
    const response = await paymentsRoute.GET(
      jsonRequest("/api/admin/league/payments?status=pending"),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.listLeaguePayments).toHaveBeenCalledWith({
      status: ["pending"],
    })
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache")
  })

  it("GET without a status filter reads all", async () => {
    serviceMocks.listLeaguePayments.mockResolvedValue([])
    const response = await paymentsRoute.GET(
      jsonRequest("/api/admin/league/payments"),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.listLeaguePayments).toHaveBeenCalledWith({})
  })

  it("POST marks paid and returns {id, version}", async () => {
    serviceMocks.markLeaguePayment.mockResolvedValue({ id: "e1", version: 4 })
    const response = await paymentIdRoute.POST(
      jsonRequest(
        "/api/admin/league/payments/pay-1",
        { status: "paid", providerReference: "rcpt_1" },
        "POST",
      ),
      routeContext({ id: "pay-1" }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "e1", version: 4 })
    expect(serviceMocks.markLeaguePayment).toHaveBeenCalledWith(ADMIN.id, {
      paymentId: "pay-1",
      status: "paid",
      providerReference: "rcpt_1",
    })
  })

  it("PATCH aliases POST for the same transition", async () => {
    serviceMocks.markLeaguePayment.mockResolvedValue({ id: "e1", version: 5 })
    const response = await paymentIdRoute.PATCH(
      jsonRequest("/api/admin/league/payments/pay-1", { status: "comped" }, "PATCH"),
      routeContext({ id: "pay-1" }),
    )
    expect(response.status).toBe(200)
    expect(serviceMocks.markLeaguePayment).toHaveBeenCalledWith(ADMIN.id, {
      paymentId: "pay-1",
      status: "comped",
      providerReference: undefined,
    })
  })

  it("rejects unknown transition statuses with 400", async () => {
    const response = await paymentIdRoute.POST(
      jsonRequest("/api/admin/league/payments/pay-1", { status: "pending" }, "POST"),
      routeContext({ id: "pay-1" }),
    )
    expect(response.status).toBe(400)
  })

  it("maps PAYMENT_NOT_FOUND to 404", async () => {
    serviceMocks.markLeaguePayment.mockRejectedValue(
      new LeagueDomainError("PAYMENT_NOT_FOUND", "Payment not found: pay-x"),
    )
    const response = await paymentIdRoute.POST(
      jsonRequest("/api/admin/league/payments/pay-x", { status: "paid" }, "POST"),
      routeContext({ id: "pay-x" }),
    )
    expect(response.status).toBe(404)
  })
})
