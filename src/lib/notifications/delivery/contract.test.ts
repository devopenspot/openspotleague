import { describe, expect, it } from "vitest"
import {
  EmailJobSchema,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signedHeaders,
  verifySignature,
} from "./contract"

const SECRET = "test-secret"
const NOW = new Date("2026-11-05T12:00:00.000Z")

describe("internal request signing", () => {
  const body = JSON.stringify({ hello: "world" })
  const path = "/api/internal/notifications/tick"
  const headers = signedHeaders(SECRET, path, body, NOW)
  const base = {
    secret: SECRET,
    path,
    body,
    timestamp: headers[TIMESTAMP_HEADER] ?? null,
    signature: headers[SIGNATURE_HEADER] ?? null,
  }

  it("accepts a fresh, untampered request", () => {
    expect(verifySignature({ ...base, now: NOW })).toBe("ok")
  })

  it("rejects missing headers", () => {
    expect(verifySignature({ ...base, signature: null, now: NOW })).toBe("missing")
  })

  it("rejects requests outside the 5 minute window", () => {
    expect(verifySignature({ ...base, now: new Date(NOW.getTime() + 6 * 60 * 1000) })).toBe("expired")
  })

  it("rejects a tampered body or wrong secret", () => {
    expect(verifySignature({ ...base, body: `${body} `, now: NOW })).toBe("invalid")
    expect(verifySignature({ ...base, secret: "other", now: NOW })).toBe("invalid")
  })

  it("rejects a request replayed against another route", () => {
    expect(
      verifySignature({ ...base, path: "/api/internal/notifications/delivery", now: NOW }),
    ).toBe("invalid")
  })
})

describe("EmailJobSchema", () => {
  it("parses a valid job and rejects unknown channels", () => {
    const job = {
      v: 1,
      channel: "email",
      key: "n:abc",
      notificationIds: ["4b6f3b6e-6d1c-4f0a-9d3e-2f7e1b2a3c4d"],
      to: "rider@example.com",
      subject: "Contest cancelled",
      html: "<p>hi</p>",
      text: "hi",
      category: "contest_updates",
      unsubscribeUrl: "https://openspot.example.com/api/notifications/unsubscribe?token=x",
    }
    expect(EmailJobSchema.parse(job).to).toBe("rider@example.com")
    expect(EmailJobSchema.safeParse({ ...job, channel: "sms" }).success).toBe(false)
  })
})
