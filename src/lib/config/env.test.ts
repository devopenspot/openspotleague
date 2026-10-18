import { describe, expect, it } from "vitest"
import { resolveDatabaseUrl } from "./env"

describe("database URL resolution", () => {
  it("ignores blank values and prefers the runtime pooler", () => {
    expect(resolveDatabaseUrl("  ", " postgres://direct ")).toBe("postgres://direct")
    expect(resolveDatabaseUrl(" postgres://pooler ", "postgres://direct")).toBe(
      "postgres://pooler",
    )
    expect(resolveDatabaseUrl(undefined, undefined)).toBeNull()
  })
})
