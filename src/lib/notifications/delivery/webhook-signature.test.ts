import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { resendEventToReports, verifyResendWebhook } from "./webhook-signature"

const RAW_KEY = Buffer.from("test-webhook-key-32-bytes-long!!")
const SECRET = `whsec_${RAW_KEY.toString("base64")}`
const NOW = new Date("2026-11-11T12:00:00.000Z")
const TS = String(Math.floor(NOW.getTime() / 1000))
const BODY = JSON.stringify({ type: "email.bounced", data: { to: ["a@example.com"] } })

function sign(id: string, timestamp: string, body: string): string {
  return `v1,${createHmac("sha256", RAW_KEY).update(`${id}.${timestamp}.${body}`).digest("base64")}`
}

describe("verifyResendWebhook", () => {
  const base = { secret: SECRET, body: BODY, id: "msg_1", timestamp: TS, now: NOW }

  it("accepts a valid signature, also among several", () => {
    expect(verifyResendWebhook({ ...base, signature: sign("msg_1", TS, BODY) })).toBe("ok")
    expect(
      verifyResendWebhook({ ...base, signature: `v1,AAAA ${sign("msg_1", TS, BODY)}` }),
    ).toBe("ok")
  })

  it("rejects a tampered body, a wrong id and a wrong secret", () => {
    const signature = sign("msg_1", TS, BODY)
    expect(verifyResendWebhook({ ...base, body: `${BODY} `, signature })).toBe("invalid")
    expect(verifyResendWebhook({ ...base, id: "msg_2", signature })).toBe("invalid")
    expect(
      verifyResendWebhook({ ...base, secret: `whsec_${Buffer.from("other").toString("base64")}`, signature }),
    ).toBe("invalid")
  })

  it("rejects old or future timestamps and missing headers", () => {
    const old = String(Number(TS) - 301)
    expect(verifyResendWebhook({ ...base, timestamp: old, signature: sign("msg_1", old, BODY) })).toBe("expired")
    expect(verifyResendWebhook({ ...base, signature: null })).toBe("missing")
    expect(verifyResendWebhook({ ...base, id: undefined, signature: "v1,x" })).toBe("missing")
  })
})

describe("resendEventToReports", () => {
  it("suppresses permanent bounces and complaints only", () => {
    expect(
      resendEventToReports({ type: "email.bounced", data: { to: ["a@example.com"], bounce: { type: "Permanent" } } }),
    ).toEqual([{ kind: "feedback", email: "a@example.com", status: "bounced" }])
    expect(
      resendEventToReports({ type: "email.bounced", data: { to: ["a@example.com"], bounce: { type: "Temporary" } } }),
    ).toEqual([])
    expect(resendEventToReports({ type: "email.complained", data: { to: ["b@example.com", 7] } })).toEqual([
      { kind: "feedback", email: "b@example.com", status: "complained" },
    ])
    expect(resendEventToReports({ type: "email.delivered", data: { to: ["a@example.com"] } })).toEqual([])
    expect(resendEventToReports({})).toEqual([])
  })
})
