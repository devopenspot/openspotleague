import { beforeEach, describe, expect, it, vi } from "vitest"

const store = vi.hoisted(() => ({
  setStatus: vi.fn(async () => undefined),
  exhaustEmailBudget: vi.fn(async () => undefined),
  suppressAddress: vi.fn(async () => 1),
}))

vi.mock("./store", () => ({ deliveryStore: store }))
vi.mock("./index", () => ({ getDispatcher: () => null }))
vi.mock("@/lib/db/client", () => ({ getDbClient: vi.fn(), withDbWrite: vi.fn() }))
vi.mock("@/lib/notifications/service", () => ({ createNotifications: vi.fn(), setEmailPreferences: vi.fn() }))
vi.mock("@/lib/config/env", () => ({
  getEmailCaps: () => ({ daily: 95, monthly: 2900, digestShare: 0.6 }),
  getNotificationsUnsubscribeSecret: () => "s",
}))

const { applyDeliveryReports } = await import("./service")

const A = "00000000-0000-4000-8000-000000000001"
const B = "00000000-0000-4000-8000-000000000002"
const C = "00000000-0000-4000-8000-000000000003"
const NOW = new Date("2026-11-11T12:00:00.000Z")

describe("applyDeliveryReports", () => {
  beforeEach(() => vi.clearAllMocks())

  it("hands deferred rows back to pending and closes today's budget once", async () => {
    const result = await applyDeliveryReports(
      {
        reports: [
          { kind: "job", notificationIds: [A], status: "sent", messageId: "re-1" },
          { kind: "job", notificationIds: [B], status: "deferred", reason: "daily_quota_exceeded" },
          { kind: "job", notificationIds: [C], status: "deferred", reason: "daily_quota_exceeded" },
        ],
      },
      NOW,
    )
    expect(result.applied).toBe(3)
    expect(store.setStatus).toHaveBeenNthCalledWith(1, [A], "sent")
    expect(store.setStatus).toHaveBeenNthCalledWith(2, [B], "pending")
    expect(store.setStatus).toHaveBeenNthCalledWith(3, [C], "pending")
    expect(store.exhaustEmailBudget).toHaveBeenCalledTimes(1)
    expect(store.exhaustEmailBudget).toHaveBeenCalledWith({ dailyCap: 95, now: NOW })
  })

  it("suppresses addresses from bounce and complaint feedback", async () => {
    await applyDeliveryReports({
      reports: [
        { kind: "feedback", email: "a@example.com", status: "bounced" },
        { kind: "feedback", email: "b@example.com", status: "complained" },
      ],
    })
    expect(store.suppressAddress).toHaveBeenCalledWith("a@example.com", "bounce")
    expect(store.suppressAddress).toHaveBeenCalledWith("b@example.com", "complaint")
    expect(store.exhaustEmailBudget).not.toHaveBeenCalled()
  })
})
