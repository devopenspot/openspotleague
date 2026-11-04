import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_PAYPAL_SUPPORT_URL,
  isValidPaypalSupportUrl,
  resolveDatabaseUrl,
  resolvePaypalSupportUrl,
} from "./env"

describe("database URL resolution", () => {
  it("ignores blank values and prefers the runtime pooler", () => {
    expect(resolveDatabaseUrl("  ", " postgres://direct ")).toBe("postgres://direct")
    expect(resolveDatabaseUrl(" postgres://pooler ", "postgres://direct")).toBe(
      "postgres://pooler",
    )
    expect(resolveDatabaseUrl(undefined, undefined)).toBeNull()
  })

  it("prefers the Hyperdrive binding over the configured URLs", async () => {
    vi.resetModules()
    vi.stubEnv("SUPABASE_DATABASE_URL", "postgres://pooler")
    const { getDatabaseUrl, isUsingHyperdrive, setHyperdriveUrl } = await import("./env")

    expect(getDatabaseUrl()).toBe("postgres://pooler")
    expect(isUsingHyperdrive()).toBe(false)

    setHyperdriveUrl("postgres://hyperdrive")

    expect(getDatabaseUrl()).toBe("postgres://hyperdrive")
    expect(isUsingHyperdrive()).toBe(true)
    vi.unstubAllEnvs()
  })
})

describe("PayPal support URL validation and resolution", () => {
  it("accepts https PayPal checkout, donate, and paypal.me URLs with a non-empty path", () => {
    expect(
      isValidPaypalSupportUrl("https://www.paypal.com/ncp/payment/8XU46EVXHAVYL"),
    ).toBe(true)
    expect(
      isValidPaypalSupportUrl(
        "https://www.paypal.com/donate/?hosted_button_id=8XU46EVXHAVYL",
      ),
    ).toBe(true)
    expect(isValidPaypalSupportUrl("https://paypal.me/openspot")).toBe(true)
    expect(isValidPaypalSupportUrl("https://www.paypal.me/openspot")).toBe(true)
  })

  it("rejects non-https schemes, non-PayPal hosts, and bare root URLs", () => {
    expect(
      isValidPaypalSupportUrl("http://www.paypal.com/ncp/payment/8XU46EVXHAVYL"),
    ).toBe(false)
    expect(isValidPaypalSupportUrl("https://evil.example.com/paypal")).toBe(false)
    expect(isValidPaypalSupportUrl("https://www.paypal.com/")).toBe(false)
    expect(isValidPaypalSupportUrl("not-a-url")).toBe(false)
  })

  it("falls back to hosted button ID or DEFAULT_PAYPAL_SUPPORT_URL when URL is unset or invalid", () => {
    expect(resolvePaypalSupportUrl(undefined)).toBe(DEFAULT_PAYPAL_SUPPORT_URL)
    expect(resolvePaypalSupportUrl("   ")).toBe(DEFAULT_PAYPAL_SUPPORT_URL)
    expect(resolvePaypalSupportUrl("https://evil.example.com/pay")).toBe(
      DEFAULT_PAYPAL_SUPPORT_URL,
    )
    expect(resolvePaypalSupportUrl(undefined, "8XU46EVXHAVYL")).toBe(
      "https://www.paypal.com/ncp/payment/8XU46EVXHAVYL",
    )
    expect(resolvePaypalSupportUrl(undefined, "invalid id!")).toBe(
      DEFAULT_PAYPAL_SUPPORT_URL,
    )
    expect(resolvePaypalSupportUrl(" https://paypal.me/openspot ")).toBe(
      "https://paypal.me/openspot",
    )
  })
})
