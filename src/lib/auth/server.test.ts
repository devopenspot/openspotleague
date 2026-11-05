import { describe, expect, it } from "vitest"
import { authorizationErrorResponse, AuthConfigError, sanitizeNext } from "./server"
import { AuthorizationError } from "@/lib/services/profile/authorization"

describe("authorizationErrorResponse", () => {
  it("maps AuthorizationError to its own status", async () => {
    expect((await authorizationErrorResponse(new AuthorizationError("UNAUTHENTICATED"))).status).toBe(401)
    expect((await authorizationErrorResponse(new AuthorizationError("FORBIDDEN"))).status).toBe(403)
  })

  it("maps AuthConfigError to 503", () => {
    expect(authorizationErrorResponse(new AuthConfigError()).status).toBe(503)
  })

  it("maps infrastructure failures to a generic 503 without leaking internals", async () => {
    const res = authorizationErrorResponse(new Error("connect ECONNREFUSED db.xxx.supabase.co:5432"))
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("Service temporarily unavailable")
    expect(body.error).not.toContain("ECONNREFUSED")
  })

  it("keeps the legacy Admin only mapping", () => {
    expect(authorizationErrorResponse(new Error("Admin only")).status).toBe(403)
  })
})

describe("sanitizeNext", () => {
  it("returns guests to League pages after sign-in (QR invites, create, console)", () => {
    expect(sanitizeNext("/league/join/abcDEF123456")).toBe("/league/join/abcDEF123456")
    expect(sanitizeNext(encodeURIComponent("/league/new"))).toBe("/league/new")
    expect(sanitizeNext("/league/night-jam-1/manage")).toBe("/league/night-jam-1/manage")
  })

  it("still rejects paths outside the allow-list", () => {
    expect(sanitizeNext("/leaguex")).toBe("/")
    expect(sanitizeNext("//evil.example/league")).toBe("/")
  })
})
