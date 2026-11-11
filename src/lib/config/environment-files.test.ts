import { describe, expect, it } from "vitest"
import {
  DEPLOY_ENVIRONMENTS,
  NOTIFICATION_SECRET_NAMES,
  RUNTIME_VARIABLE_NAMES,
  SECRET_NAMES,
  readEnvironmentFile,
} from "../../../cloudflare.config"

// The committed .env.develop / .env.production are public (docs/environments.md).
const files = Object.fromEntries(DEPLOY_ENVIRONMENTS.map((e) => [e, readEnvironmentFile(e)]))
const secretNames = new Set<string>([...SECRET_NAMES, ...NOTIFICATION_SECRET_NAMES])
const ALLOWED_KEY_NAMES = new Set(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])

describe.each(DEPLOY_ENVIRONMENTS)(".env.%s", (environment) => {
  const values = files[environment] ?? {}

  it("holds no declared secret", () => {
    expect(Object.keys(values).filter((name) => secretNames.has(name))).toEqual([])
  })

  it("holds nothing that looks like a secret", () => {
    const suspiciousNames = Object.keys(values).filter(
      (name) => /SECRET|PASSWORD|TOKEN|PRIVATE|_KEY(_ID)?$/.test(name) && !ALLOWED_KEY_NAMES.has(name),
    )
    expect(suspiciousNames).toEqual([])
    const suspiciousValues = Object.entries(values)
      .filter(([, value]) => /sb_secret_|eyJ[A-Za-z0-9_-]{20,}|postgres(ql)?:\/\/[^@\s]+:[^@\s]+@/.test(value))
      .map(([name]) => name)
    expect(suspiciousValues).toEqual([])
  })

  it("declares every runtime variable the Worker needs", () => {
    expect(RUNTIME_VARIABLE_NAMES.filter((name) => !values[name])).toEqual([])
  })

  it("does not set APP_ENV itself (the build mode does)", () => {
    expect(values.APP_ENV).toBeUndefined()
    expect(values.NEXT_PUBLIC_APP_ENV).toBeUndefined()
  })
})

describe("environment files", () => {
  it("develop and production declare the same names", () => {
    const [develop = {}, production = {}] = DEPLOY_ENVIRONMENTS.map((e) => files[e])
    expect(Object.keys(production).sort()).toEqual(Object.keys(develop).sort())
  })
})
