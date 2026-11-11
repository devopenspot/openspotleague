import { describe, expect, it } from "vitest"
import {
  PROJECT_REFS,
  TargetGuardError,
  assertTargetAllowed,
  describeTarget,
  detectTarget,
  projectRefFromUrl,
  type DbTarget,
  type TargetOperation,
} from "./target"

const DEV = PROJECT_REFS.develop
const PROD = PROJECT_REFS.production

const pooler = (ref: string, port = 5432) =>
  `postgres://postgres.${ref}:secret@aws-0-us-east-1.pooler.supabase.com:${port}/postgres?sslmode=require`

describe("projectRefFromUrl", () => {
  it("reads every Supabase URL form", () => {
    expect(projectRefFromUrl(pooler(DEV))).toBe(DEV)
    expect(projectRefFromUrl(`postgres://postgres:pw@db.${PROD}.supabase.co:5432/postgres`)).toBe(PROD)
    expect(projectRefFromUrl(`https://${PROD}.supabase.co`)).toBe(PROD)
  })

  it("returns null for other hosts and junk", () => {
    expect(projectRefFromUrl("postgres://postgres:pw@127.0.0.1:54399/postgres")).toBeNull()
    expect(projectRefFromUrl("not a url")).toBeNull()
    expect(projectRefFromUrl(undefined)).toBeNull()
    expect(projectRefFromUrl(`https://${PROD}.supabase.co.evil.example`)).toBeNull()
  })
})

describe("detectTarget", () => {
  it("detects develop and production and reports the host without the password", () => {
    const target = detectTarget({ SUPABASE_DIRECT_URL: pooler(PROD), SUPABASE_URL: `https://${PROD}.supabase.co` })
    expect(target).toEqual({ environment: "production", ref: PROD, host: "aws-0-us-east-1.pooler.supabase.com:5432" })
    expect(describeTarget(target)).not.toContain("secret")
    expect(detectTarget({ SUPABASE_DATABASE_URL: pooler(DEV, 6543) }).environment).toBe("develop")
  })

  it("treats a local database as unknown", () => {
    expect(detectTarget({ SUPABASE_DIRECT_URL: "postgres://postgres:pw@127.0.0.1:54399/postgres" })).toMatchObject({
      environment: "unknown",
      ref: null,
    })
  })

  it("throws when the variables point at different projects", () => {
    expect(() =>
      detectTarget({ SUPABASE_DIRECT_URL: pooler(DEV), NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }),
    ).toThrow(/mixes Supabase projects/)
  })
})

describe("assertTargetAllowed", () => {
  const develop: DbTarget = { environment: "develop", ref: DEV, host: "h" }
  const production: DbTarget = { environment: "production", ref: PROD, host: "h" }
  const local: DbTarget = { environment: "unknown", ref: null, host: "127.0.0.1" }
  const run = (target: DbTarget, operation: TargetOperation, extra: Partial<Parameters<typeof assertTargetAllowed>[0]> = {}) =>
    () => assertTargetAllowed({ target, operation, ci: false, confirmed: false, ...extra })

  it("allows everything on develop and on a local database", () => {
    for (const op of ["read", "write", "destructive"] as const) {
      expect(run(develop, op)).not.toThrow()
      expect(run(local, op)).not.toThrow()
    }
  })

  it("never allows destructive operations on production, even in CI or confirmed", () => {
    expect(run(production, "destructive", { ci: true, confirmed: true })).toThrow(TargetGuardError)
  })

  it("allows production writes only from CI or with confirmation", () => {
    expect(run(production, "write")).toThrow(/OPENSPOT_CONFIRM_PRODUCTION/)
    expect(run(production, "write", { ci: true })).not.toThrow()
    expect(run(production, "write", { confirmed: true })).not.toThrow()
    expect(run(production, "read")).not.toThrow()
  })

  it("stops when OPENSPOT_ENV and the connection disagree", () => {
    expect(run(develop, "read", { requested: "production" })).toThrow(/points at develop/)
    expect(run(local, "read", { requested: "develop" })).toThrow(/points at unknown/)
    expect(run(develop, "read", { requested: "staging" })).toThrow(/must be develop or production/)
    expect(run(develop, "read", { requested: "develop" })).not.toThrow()
    expect(run(local, "write", { requested: "local" })).not.toThrow()
  })
})
