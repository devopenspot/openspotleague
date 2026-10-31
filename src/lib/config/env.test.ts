import { describe, expect, it, vi } from "vitest"
import { resolveDatabaseUrl } from "./env"

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
