import { describe, expect, it } from "vitest"
import { clientIp } from "./rate-limit"

function requestWith(headers: Record<string, string>) {
  return new Request("https://example.com", { headers })
}

describe("clientIp", () => {
  it("ignores client-controlled headers when cf-connecting-ip is present", () => {
    const request = requestWith({
      "cf-connecting-ip": "203.0.113.7",
      "x-vercel-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      "x-forwarded-for": "198.51.100.3",
    })
    expect(clientIp(request)).toBe("203.0.113.7")
  })

  it("falls back to the forwarded headers without cf-connecting-ip", () => {
    expect(clientIp(requestWith({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2")
  })
})
