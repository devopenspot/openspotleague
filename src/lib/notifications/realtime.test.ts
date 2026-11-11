import { describe, expect, it } from "vitest"
import { shouldRefreshOnChange } from "./realtime"

describe("shouldRefreshOnChange", () => {
  it("refreshes on a new or deleted notification", () => {
    expect(shouldRefreshOnChange({ eventType: "INSERT", new: { read_at: null } })).toBe(true)
    expect(shouldRefreshOnChange({ eventType: "DELETE", new: {} })).toBe(true)
  })

  it("refreshes when a row was marked read", () => {
    expect(
      shouldRefreshOnChange({ eventType: "UPDATE", new: { read_at: "2026-11-05T12:00:00Z" } }),
    ).toBe(true)
  })

  it("ignores email outbox updates on an unread row", () => {
    expect(
      shouldRefreshOnChange({ eventType: "UPDATE", new: { read_at: null, email_status: "sent" } }),
    ).toBe(false)
  })

  it("refreshes when the row is missing or has no read_at", () => {
    expect(shouldRefreshOnChange({ eventType: "UPDATE" })).toBe(true)
    expect(shouldRefreshOnChange({ eventType: "UPDATE", new: {} })).toBe(true)
    expect(shouldRefreshOnChange({})).toBe(true)
  })
})
