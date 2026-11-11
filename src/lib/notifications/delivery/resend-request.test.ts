import { describe, expect, it } from "vitest"
import type { EmailJob } from "./contract"
import { buildResendRequest, classifyResendResponse } from "./resend-request"

const JOB: EmailJob = {
  v: 1,
  channel: "email",
  key: "n:abc123",
  notificationIds: ["00000000-0000-4000-8000-000000000001"],
  to: "rider@example.com",
  subject: "Contest started · Night Jam",
  html: "<p>hi</p>",
  text: "hi",
  category: "contest_updates",
  unsubscribeUrl: "https://openspot.example.com/api/notifications/unsubscribe?token=t",
}

describe("buildResendRequest", () => {
  it("sends one recipient with the idempotency key and RFC 8058 headers", () => {
    const init = buildResendRequest(JOB, {
      apiKey: "re_test",
      from: "OpenSpot League <no-reply@mail.example.com>",
      replyTo: "help@example.com",
    })
    const headers = init.headers as Record<string, string>
    expect(init.method).toBe("POST")
    expect(headers.authorization).toBe("Bearer re_test")
    expect(headers["idempotency-key"]).toBe("n:abc123")
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      from: "OpenSpot League <no-reply@mail.example.com>",
      to: ["rider@example.com"],
      reply_to: "help@example.com",
      subject: JOB.subject,
      html: JOB.html,
      text: JOB.text,
      headers: {
        "List-Unsubscribe": `<${JOB.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "category", value: "contest_updates" }],
    })
  })

  it("omits reply_to when none is set", () => {
    const body = JSON.parse(buildResendRequest(JOB, { apiKey: "k", from: "a@b.co" }).body as string)
    expect(body).not.toHaveProperty("reply_to")
  })
})

describe("classifyResendResponse", () => {
  it("maps each status to an outcome", () => {
    expect(classifyResendResponse(200, { id: "re-1" })).toEqual({ kind: "sent", id: "re-1" })
    expect(classifyResendResponse(429, { name: "daily_quota_exceeded" })).toEqual({
      kind: "quota",
      reason: "daily_quota_exceeded",
    })
    expect(classifyResendResponse(429, { name: "monthly_quota_exceeded" }).kind).toBe("quota")
    expect(classifyResendResponse(429, { name: "rate_limit_exceeded" }).kind).toBe("retry")
    expect(classifyResendResponse(422, { name: "validation_error" })).toEqual({
      kind: "permanent",
      reason: "validation_error",
    })
    expect(classifyResendResponse(400, null).kind).toBe("permanent")
    // Account-wide problems retry so they reach the DLQ alarm.
    expect(classifyResendResponse(403, { name: "invalid_from_address" }).kind).toBe("retry")
    expect(classifyResendResponse(500, "oops").kind).toBe("retry")
  })

  it("never carries the provider's message text", () => {
    const outcome = classifyResendResponse(422, {
      name: "validation_error",
      message: "Invalid `to` field: rider@example.com",
    })
    expect(JSON.stringify(outcome)).not.toContain("rider@example.com")
  })
})
