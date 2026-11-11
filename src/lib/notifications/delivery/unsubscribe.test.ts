import { describe, expect, it } from "vitest"
import { createUnsubscribeToken, readUnsubscribeToken, unsubscribeUrl } from "./unsubscribe"

const SECRET = "unsub-secret"
const USER = "4b6f3b6e-6d1c-4f0a-9d3e-2f7e1b2a3c4d"

describe("unsubscribe tokens", () => {
  it("round-trips user and category", () => {
    const token = createUnsubscribeToken(SECRET, USER, "judging")
    expect(readUnsubscribeToken(SECRET, token)).toEqual({ userId: USER, category: "judging" })
  })

  it("rejects tampering, wrong secret and junk", () => {
    const token = createUnsubscribeToken(SECRET, USER, "results")
    const forged = `${Buffer.from(`${USER}:reminders`).toString("base64url")}.${token.split(".")[1]}`
    expect(readUnsubscribeToken(SECRET, forged)).toBeNull()
    expect(readUnsubscribeToken("other", token)).toBeNull()
    expect(readUnsubscribeToken(SECRET, "nope")).toBeNull()
    expect(readUnsubscribeToken(SECRET, null)).toBeNull()
  })

  it("builds an absolute URL with no personal data", () => {
    const token = createUnsubscribeToken(SECRET, USER, "results")
    const url = unsubscribeUrl("https://openspot.example.com", token)
    expect(url).toMatch(/^https:\/\/openspot\.example\.com\/api\/notifications\/unsubscribe\?token=/)
    expect(url).not.toContain("@")
  })
})
