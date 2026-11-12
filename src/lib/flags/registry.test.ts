import { describe, expect, it } from "vitest"
import { FLAG_KEY_PATTERN, type FlagDefinition } from "./definition"
import { FLAGS } from "./registry"

// docs/feature-flags.md → Lifecycle. When this fails because a flag is past
// its removeBy date, remove the flag (and its off path) or move the date in
// a pull request that says why.
const entries = Object.entries(FLAGS as Readonly<Record<string, FlagDefinition>>)
const today = new Date().toISOString().slice(0, 10)

describe("feature flag registry", () => {
  it("keeps the number of live flags small", () => {
    expect(entries.length).toBeLessThanOrEqual(8)
  })

  it.each(entries)("%s is well formed", (key, flag) => {
    expect(key).toMatch(FLAG_KEY_PATTERN)
    expect(flag.description.trim()).not.toBe("")
    expect(flag.owner.trim()).not.toBe("")
    expect(flag.removeBy).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(flag.removeBy))).toBe(false)
  })

  it.each(entries)("%s is not past its removeBy date", (_key, flag) => {
    expect(flag.removeBy >= today, `removeBy ${flag.removeBy} has passed`).toBe(true)
  })
})
