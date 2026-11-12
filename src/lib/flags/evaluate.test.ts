import { describe, expect, it } from "vitest"
import { defineFlag, type FlagOverride } from "./definition"
import { evaluateFlag, rolloutBucket } from "./evaluate"

const flag = defineFlag({
  description: "test",
  owner: "devopenspot",
  removeBy: "2099-01-01",
  defaults: { local: true, develop: true, production: false },
})

function override(patch: Partial<FlagOverride> = {}): FlagOverride {
  return {
    key: "testFlag",
    enabled: true,
    rolloutPercent: 100,
    allowUserIds: [],
    allowRoles: [],
    updatedBy: null,
    updatedAt: new Date("2026-11-12T00:00:00Z"),
    ...patch,
  }
}

const users = Array.from({ length: 2000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`)

describe("evaluateFlag", () => {
  it("uses the environment default without an override", () => {
    expect(evaluateFlag("testFlag", flag, undefined, "develop")).toBe(true)
    expect(evaluateFlag("testFlag", flag, undefined, "production")).toBe(false)
    expect(evaluateFlag("testFlag", flag, undefined, "local")).toBe(true)
  })

  it("an override that is off is a kill switch, even for allow-listed users", () => {
    const off = override({ enabled: false, allowUserIds: [users[0]!], allowRoles: ["admin"] })
    expect(evaluateFlag("testFlag", flag, off, "develop", { userId: users[0], roles: ["admin"] })).toBe(false)
  })

  it("turns on for allow-listed users and roles at 0 %", () => {
    const targeted = override({ rolloutPercent: 0, allowUserIds: [users[1]!], allowRoles: ["admin"] })
    expect(evaluateFlag("testFlag", flag, targeted, "production", { userId: users[1] })).toBe(true)
    expect(evaluateFlag("testFlag", flag, targeted, "production", { userId: users[2], roles: new Set(["admin"]) })).toBe(true)
    expect(evaluateFlag("testFlag", flag, targeted, "production", { userId: users[2], roles: ["curator"] })).toBe(false)
  })

  it("counts anonymous visitors only at 100 %", () => {
    expect(evaluateFlag("testFlag", flag, override({ rolloutPercent: 99 }), "production")).toBe(false)
    expect(evaluateFlag("testFlag", flag, override({ rolloutPercent: 100 }), "production")).toBe(true)
  })

  it("rolls out to roughly the given share of users", () => {
    const on = users.filter((userId) => evaluateFlag("testFlag", flag, override({ rolloutPercent: 25 }), "production", { userId }))
    expect(on.length / users.length).toBeGreaterThan(0.2)
    expect(on.length / users.length).toBeLessThan(0.3)
  })

  it("only adds users when the percentage grows", () => {
    const at = (rolloutPercent: number) =>
      new Set(users.filter((userId) => evaluateFlag("testFlag", flag, override({ rolloutPercent }), "production", { userId })))
    const ten = at(10)
    const fifty = at(50)
    for (const userId of ten) expect(fifty.has(userId)).toBe(true)
  })
})

describe("rolloutBucket", () => {
  it("is stable and in range", () => {
    expect(rolloutBucket("a", users[0]!)).toBe(rolloutBucket("a", users[0]!))
    for (const userId of users.slice(0, 200)) {
      const bucket = rolloutBucket("a", userId)
      expect(bucket).toBeGreaterThanOrEqual(0)
      expect(bucket).toBeLessThan(100)
    }
  })

  it("spreads users differently per flag", () => {
    const same = users.slice(0, 200).filter((u) => rolloutBucket("flagOne", u) === rolloutBucket("flagTwo", u))
    expect(same.length).toBeLessThan(20)
  })
})
