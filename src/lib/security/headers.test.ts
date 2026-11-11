import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { NOINDEX_HEADER, cspValue, isIndexableEnvironment, securityHeaders } from "./headers"

// next.config.mjs cannot import TypeScript, so it repeats these values.
// AGENTS.md: the two places must stay in sync.
const nextConfig = readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8")

describe("security headers", () => {
  it("next.config.mjs repeats the report-only CSP exactly", () => {
    expect(nextConfig).toContain(cspValue())
  })

  it("next.config.mjs repeats every base header", () => {
    for (const { key, value } of securityHeaders) {
      expect(nextConfig).toContain(`{ key: "${key}", value: "${value}" }`)
    }
  })

  it("keeps develop out of search engines in both places", () => {
    expect(isIndexableEnvironment("develop")).toBe(false)
    expect(isIndexableEnvironment("production")).toBe(true)
    expect(isIndexableEnvironment(undefined)).toBe(true)
    expect(nextConfig).toContain(`{ key: "${NOINDEX_HEADER.key}", value: "${NOINDEX_HEADER.value}" }`)
  })
})
