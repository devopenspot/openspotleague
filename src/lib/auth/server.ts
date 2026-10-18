import "server-only"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/config/env"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { User } from "@/lib/auth/user"
import { getServerUserFromCookies } from "@/lib/auth/auth"
import {
  AuthorizationError,
  type AuthorizationRequirement,
  getAuthorizationSnapshot,
  hasEventCuratorRole,
  hasSpotCuratorRole,
  hasTrickCuratorRole,
  hasTvCuratorRole,
  requireCurationForUser,
  requireAdministratorForUser,
  requireEventCurationForUser,
  requirePermissionForUser,
  requireRoleForUser,
  requireSpotCurationForUser,
  requireTrickCurationForUser,
  requireTvCurationForUser,
} from "@/lib/services/profile/authorization"

const DEFAULT_NEXT = "/"

export class AuthConfigError extends Error {
  constructor() {
    super("Auth is not configured")
    this.name = "AuthConfigError"
  }
}

export function requireAuthConfig(): { url: string; publishableKey: string } {
  const url = getSupabaseUrl()
  const publishableKey = getSupabasePublishableKey()
  if (!url || !publishableKey) throw new AuthConfigError()
  return { url, publishableKey }
}

export function configNotReadyResponse() {
  return NextResponse.json(
    { error: "Auth is not configured" },
    { status: 503 },
  )
}

export function authorizationErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthConfigError) return configNotReadyResponse()
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    )
  }
  if (error instanceof Error && error.message === "Admin only") {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  // Non-authorization failures (DB outage, timeouts) are infrastructure
  // problems — 503 without leaking internals, not 401.
  return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
}

const SAFE_NEXT_RE = /^\/(?:admin|map|profile|spots|events)(?:\/|$)|^\/$/

export function sanitizeNext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return DEFAULT_NEXT
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return DEFAULT_NEXT
  }
  if (decoded.includes("\\") || decoded.includes("\0")) return DEFAULT_NEXT
  if (/^\s*javascript:/i.test(decoded) || /^\s*data:/i.test(decoded)) return DEFAULT_NEXT
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(decoded)) return DEFAULT_NEXT
  if (decoded.includes("..")) return DEFAULT_NEXT
  let url: URL
  try {
    url = new URL(decoded, "http://a")
  } catch {
    return DEFAULT_NEXT
  }
  if (url.host !== "a" || decoded.startsWith("//") || decoded.startsWith("%2f") || decoded.includes("%2F")) return DEFAULT_NEXT
  if (!SAFE_NEXT_RE.test(url.pathname)) return DEFAULT_NEXT
  return url.pathname + url.search + url.hash
}

export function isSafeNext(value: unknown): boolean {
  return sanitizeNext(value) !== DEFAULT_NEXT || value === "/"
}

export { originFromRequest } from "@/lib/auth/origin"

export async function getSessionUser(): Promise<User | null> {
  return getServerUserFromCookies()
}

/**
 * Server-side guard for protected pages. Throws a `NEXT_REDIRECT` to
 * `/login?next=<path>` if there is no real Supabase session. Must be
 * called from a Server Component — do not wrap in try/catch.
 */
export async function requireUserOrRedirect(nextPath: string): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }
  return user
}

/**
 * Server-side guard for server actions and route handlers. Throws a
 * plain `Error` instead of triggering a navigation — callers handle it
 * in a try/catch.
 */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error("Not signed in")
  }
  return user
}

export async function requirePermission(
  requirement: AuthorizationRequirement,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requirePermissionForUser(user, requirement)
}

export async function requireCurationAccess(
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireCurationForUser(user, requirement)
}

export async function requireAdministrator(): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireAdministratorForUser(user)
}

export async function requireRole(
  role: "admin" | "curator" | "spot_curator" | "event_curator" | "trick_curator" | "tv_curator",
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireRoleForUser(user, role)
}

export async function requireSpotCurationAccess(
  countryCode: string,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireSpotCurationForUser(user, countryCode, requirement)
}

export async function requireEventCurationAccess(
  countryCode: string,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireEventCurationForUser(user, countryCode, requirement)
}

export async function requireTrickCurationAccess(
  disciplineSlug: string,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireTrickCurationForUser(user, disciplineSlug, requirement)
}

export async function requireTvCurationAccess(
  disciplineSlug: string,
  requirement: AuthorizationRequirement = "taxonomy.use",
): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError("UNAUTHENTICATED")
  return requireTvCurationForUser(user, disciplineSlug, requirement)
}

export async function requirePermissionOrRedirect(
  requirement: AuthorizationRequirement,
  nextPath: string,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }
  try {
    return await requirePermissionForUser(user, requirement)
  } catch {
    redirect("/")
  }
}

export async function requireCurationAccessOrRedirect(
  nextPath: string,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }
  try {
    return await requireCurationForUser(user)
  } catch {
    redirect("/")
  }
}

export async function requireAdministratorOrRedirect(
  nextPath: string,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }
  try {
    return await requireAdministratorForUser(user)
  } catch {
    redirect(`/admin/curation?denied=${encodeURIComponent(nextPath)}`)
  }
}

async function requireScopedRoleOrRedirect(
  nextPath: string,
  check: (snapshot: Awaited<ReturnType<typeof getAuthorizationSnapshot>>) => boolean,
): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }
  try {
    const snapshot = await getAuthorizationSnapshot(user.id)
    if (!check(snapshot)) throw new AuthorizationError("FORBIDDEN")
    return user
  } catch {
    redirect(`/admin/curation?denied=${encodeURIComponent(nextPath)}`)
  }
}

export async function requireSpotCurationRoleOrRedirect(
  nextPath: string,
): Promise<User> {
  return requireScopedRoleOrRedirect(nextPath, hasSpotCuratorRole)
}

export async function requireEventCurationRoleOrRedirect(
  nextPath: string,
): Promise<User> {
  return requireScopedRoleOrRedirect(nextPath, hasEventCuratorRole)
}

export async function requireTrickCurationRoleOrRedirect(
  nextPath: string,
): Promise<User> {
  return requireScopedRoleOrRedirect(nextPath, hasTrickCuratorRole)
}

export async function requireTvCurationRoleOrRedirect(
  nextPath: string,
): Promise<User> {
  return requireScopedRoleOrRedirect(nextPath, hasTvCuratorRole)
}

/**
 * Server-side guard for the administrative Server Components. Curators may
 * access the content-management surface; role management remains admin-only.
 */
export async function requireAdminOrRedirect(nextPath: string): Promise<User> {
  return requireCurationAccessOrRedirect(nextPath)
}

/**
 * Shared administrative route guard. With a permission argument it supports
 * curator access; without one it requires the unrestricted admin role.
 * The legacy error messages are retained for existing route boundaries.
 */
export async function requireAdmin(
  requirement?: AuthorizationRequirement,
): Promise<User> {
  try {
    return requirement
      ? await requireCurationAccess(requirement)
      : await requireAdministrator()
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const normalized = new Error(
        error.status === 401 ? "Not signed in" : "Admin only",
      ) as Error & { cause?: unknown }
      normalized.cause = error
      throw normalized
    }
    throw error
  }
}

export async function signInWithGoogle(opts: {
  origin: string
  next: string
}): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${opts.origin}/auth/callback?next=${encodeURIComponent(opts.next)}`,
      scopes: "email profile",
    },
  })
  if (error) return { url: null, error: error.message }
  return { url: data.url ?? null, error: null }
}

export async function signOut(): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient()
  const { log } = await import("@/lib/utils/log")
  // Preferred: global sign-out via user JWT (no service_role needed)
  try {
    const { error: globalError } = await supabase.auth.signOut({ scope: "global" } as unknown as Parameters<typeof supabase.auth.signOut>[0])
    if (globalError) log.warn("signOut global failed", { error: globalError.message })
  } catch (e) {
    log.warn("signOut global failed", { error: String(e) })
  }
  // Best-effort service_role revoke for leaked refresh token
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (accessToken) {
      const { getAdminClient } = await import("@/lib/auth/auth")
      const admin = getAdminClient()
      if (admin) {
        const { error: revokeError } = await admin.auth.admin.signOut(accessToken)
        if (revokeError) log.warn("signOut admin revoke failed", { error: revokeError.message })
      }
    }
  } catch (e) {
    log.warn("signOut admin revoke failed", { error: String(e) })
  }
  const { error } = await supabase.auth.signOut()
  return { error: error?.message ?? null }
}
