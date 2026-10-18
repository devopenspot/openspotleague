import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { getDbClient, withDbRetry } from "@/lib/db/client"
import { AUTHZ_CACHE_LIFE } from "@/lib/cache/lifetimes"
import {
  curatorCountryScopes,
  curatorDisciplineScopes,
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import type { User } from "@/lib/auth/user"
import type { RoleSlug } from "@/lib/auth/roles"
import { SCOPED_CURATOR_ROLES } from "@/lib/auth/roles"
import { env } from "@/lib/config/env"

export { ROLE_SLUGS, type RoleSlug } from "@/lib/auth/roles"

export const PERMISSION_SLUGS = [
  "content.read",
  "content.write",
  "media.manage",
  "taxonomy.use",
  "roles.manage",
  "users.manage",
  "database.reset",
  "migrations.manage",
  "operational.settings",
  "league.manage",
] as const
export type PermissionSlug = (typeof PERMISSION_SLUGS)[number]

export type AuthorizationRequirement =
  | PermissionSlug
  | readonly PermissionSlug[]

export interface AuthorizationSnapshot {
  roles: ReadonlySet<string>
  permissions: ReadonlySet<string>
  countryScopes: ReadonlySet<string>
  disciplineScopes: ReadonlySet<string>
}

export type CuratorScope = {
  countries: readonly string[]
  disciplines: readonly string[]
}

export class AuthorizationError extends Error {
  readonly status: 401 | 403
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN"

  constructor(
    code: "UNAUTHENTICATED" | "FORBIDDEN",
    message = "You are not authorized to perform this action",
  ) {
    super(message)
    this.name = "AuthorizationError"
    this.code = code
    this.status = code === "UNAUTHENTICATED" ? 401 : 403
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError
}

export function hasRole(
  snapshot: AuthorizationSnapshot,
  role: RoleSlug,
): boolean {
  return snapshot.roles.has(role)
}

export function hasAnyRole(
  snapshot: AuthorizationSnapshot,
  rolesToCheck: readonly RoleSlug[],
): boolean {
  return rolesToCheck.some((role) => hasRole(snapshot, role))
}

export function hasPermission(
  snapshot: AuthorizationSnapshot,
  requirement: AuthorizationRequirement,
): boolean {
  const required = typeof requirement === "string" ? [requirement] : requirement
  return required.every((permission) => snapshot.permissions.has(permission))
}

export function hasCountryScope(snapshot: AuthorizationSnapshot, countryCode: string): boolean {
  if (hasRole(snapshot, "admin")) return true
  return snapshot.countryScopes.has(countryCode.toUpperCase())
}

export function hasDisciplineScope(snapshot: AuthorizationSnapshot, disciplineSlug: string): boolean {
  if (hasRole(snapshot, "admin")) return true
  return snapshot.disciplineScopes.has(disciplineSlug.toLowerCase())
}

export function hasAnyCountryScope(snapshot: AuthorizationSnapshot): boolean {
  if (hasRole(snapshot, "admin")) return true
  return snapshot.countryScopes.size > 0
}

export function hasAnyDisciplineScope(snapshot: AuthorizationSnapshot): boolean {
  if (hasRole(snapshot, "admin")) return true
  return snapshot.disciplineScopes.size > 0
}

export function isScopedCurator(snapshot: AuthorizationSnapshot): boolean {
  return hasAnyRole(snapshot, SCOPED_CURATOR_ROLES) || hasRole(snapshot, "curator")
}

export function hasSpotCuratorRole(snapshot: AuthorizationSnapshot): boolean {
  return hasAnyRole(snapshot, ["spot_curator", "curator"] as const) || hasRole(snapshot, "admin")
}

export function hasEventCuratorRole(snapshot: AuthorizationSnapshot): boolean {
  return hasAnyRole(snapshot, ["event_curator", "curator"] as const) || hasRole(snapshot, "admin")
}

export function hasTrickCuratorRole(snapshot: AuthorizationSnapshot): boolean {
  return hasAnyRole(snapshot, ["trick_curator", "curator"] as const) || hasRole(snapshot, "admin")
}

export function hasTvCuratorRole(snapshot: AuthorizationSnapshot): boolean {
  return hasAnyRole(snapshot, ["tv_curator", "curator"] as const) || hasRole(snapshot, "admin")
}

export function snapshotFromRows(
  rows: readonly { roleSlug: string; permissionSlug: string }[],
  scopes?: CuratorScope,
): AuthorizationSnapshot {
  return {
    roles: new Set(rows.map((row) => row.roleSlug)),
    permissions: new Set(rows.map((row) => row.permissionSlug)),
    countryScopes: new Set((scopes?.countries ?? []).map((c) => c.toUpperCase())),
    disciplineScopes: new Set((scopes?.disciplines ?? []).map((d) => d.toLowerCase())),
  }
}

export interface AuthorizationRows {
  rows: readonly { roleSlug: string; permissionSlug: string }[]
  countries: readonly string[]
  disciplines: readonly string[]
}

export async function fetchAuthorizationRows(
  userId: string,
): Promise<AuthorizationRows> {
  const { db } = getDbClient()
  const [rows, countryRows, disciplineRows] = await withDbRetry(
    () =>
      Promise.all([
        db
          .select({
            roleSlug: roles.slug,
            permissionSlug: permissions.slug,
          })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
          .innerJoin(
            permissions,
            eq(permissions.id, rolePermissions.permissionId),
          )
          .where(eq(userRoles.userId, userId)),
        db
          .select({ countryCode: curatorCountryScopes.countryCode })
          .from(curatorCountryScopes)
          .where(eq(curatorCountryScopes.userId, userId)),
        db
          .select({ disciplineSlug: curatorDisciplineScopes.disciplineSlug })
          .from(curatorDisciplineScopes)
          .where(eq(curatorDisciplineScopes.userId, userId)),
      ]),
    "authorization.permissions",
  )
  return {
    rows,
    countries: countryRows.map((r) => r.countryCode),
    disciplines: disciplineRows.map((r) => r.disciplineSlug),
  }
}

export async function getAuthorizationSnapshot(
  userId: string,
): Promise<AuthorizationSnapshot> {
  const { rows, countries, disciplines } = await fetchAuthorizationRows(userId)
  return snapshotFromRows(rows, { countries, disciplines })
}

/**
 * Cached authorization rows (60s revalidate, invalidated immediately via
 * `authz:user:${userId}` on role/scope mutations). Plain arrays cross the
 * `"use cache"` boundary; `getAuthorizationSnapshotCached` reconstructs the
 * `ReadonlySet` fields outside the cache boundary.
 *
 * Security note: permission revocation on read surfaces takes effect within
 * <= 60s across instances (immediate on same-instance tag revalidation).
 */
async function fetchAuthorizationRowsCached(
  userId: string,
): Promise<AuthorizationRows> {
  "use cache"
  cacheTag(`authz:user:${userId}`)
  cacheLife(AUTHZ_CACHE_LIFE)
  return fetchAuthorizationRows(userId)
}

export async function getAuthorizationSnapshotCached(
  userId: string,
): Promise<AuthorizationSnapshot> {
  const { rows, countries, disciplines } = await fetchAuthorizationRowsCached(userId)
  return snapshotFromRows(rows, { countries, disciplines })
}

export async function userHasPermission(
  userId: string,
  requirement: AuthorizationRequirement,
): Promise<boolean> {
  try {
    return hasPermission(await getAuthorizationSnapshotCached(userId), requirement)
  } catch {
    // Authorization must fail closed when the role store is unavailable.
    return false
  }
}

export async function requirePermissionForUser(
  user: User,
  requirement: AuthorizationRequirement,
): Promise<User> {
  // DB/infrastructure failures intentionally propagate (routes map them to
  // 503) instead of masquerading as an authorization decision.
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (!hasPermission(snapshot, requirement)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  return user
}

export async function requireRoleForUser(
  user: User,
  role: RoleSlug,
): Promise<User> {
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (!hasRole(snapshot, role)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  return user
}

export async function requireCurationForUser(
  user: User,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (hasRole(snapshot, "admin")) return user
  const hasLegacy = hasRole(snapshot, "curator")
  const hasScoped = hasAnyRole(snapshot, SCOPED_CURATOR_ROLES)
  if (!hasLegacy && !hasScoped) throw new AuthorizationError("FORBIDDEN")
  if (requirement !== undefined && !hasPermission(snapshot, requirement)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  return user
}

export async function requireSpotCurationForUser(
  user: User,
  countryCode: string,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (hasRole(snapshot, "admin")) return user
  if (!hasSpotCuratorRole(snapshot)) throw new AuthorizationError("FORBIDDEN")
  if (requirement !== undefined && !hasPermission(snapshot, requirement)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  const legacyBypass = env.LEGACY_CURATOR_BYPASS
  if (hasRole(snapshot, "curator")) {
    const { log } = await import("@/lib/utils/log")
    log.warn("auth.legacy_curator_bypass", { userId: user.id, scope: "spot", countryCode: countryCode.toUpperCase() })
    if (legacyBypass) return user
    // flag off: fall through to scoped check — curator without scope not sufficient
  }
  if (!hasCountryScope(snapshot, countryCode)) {
    throw new AuthorizationError("FORBIDDEN", `Missing spot curation scope for country ${countryCode.toUpperCase()}`)
  }
  return user
}

export async function requireEventCurationForUser(
  user: User,
  countryCode: string,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (hasRole(snapshot, "admin")) return user
  if (!hasEventCuratorRole(snapshot)) throw new AuthorizationError("FORBIDDEN")
  if (requirement !== undefined && !hasPermission(snapshot, requirement)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  const legacyBypass = env.LEGACY_CURATOR_BYPASS
  if (hasRole(snapshot, "curator")) {
    const { log } = await import("@/lib/utils/log")
    log.warn("auth.legacy_curator_bypass", { userId: user.id, scope: "event", countryCode: countryCode.toUpperCase() })
    if (legacyBypass) return user
  }
  if (!hasCountryScope(snapshot, countryCode)) {
    throw new AuthorizationError("FORBIDDEN", `Missing event curation scope for country ${countryCode.toUpperCase()}`)
  }
  return user
}

export async function requireTrickCurationForUser(
  user: User,
  disciplineSlug: string,
  requirement?: AuthorizationRequirement,
): Promise<User> {
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (hasRole(snapshot, "admin")) return user
  if (!hasTrickCuratorRole(snapshot)) throw new AuthorizationError("FORBIDDEN")
  if (requirement !== undefined && !hasPermission(snapshot, requirement)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  const legacyBypass = env.LEGACY_CURATOR_BYPASS
  if (hasRole(snapshot, "curator")) {
    const { log } = await import("@/lib/utils/log")
    log.warn("auth.legacy_curator_bypass", { userId: user.id, scope: "trick", disciplineSlug: disciplineSlug.toLowerCase() })
    if (legacyBypass) return user
  }
  if (!hasDisciplineScope(snapshot, disciplineSlug)) {
    throw new AuthorizationError("FORBIDDEN", `Missing trick curation scope for discipline ${disciplineSlug.toLowerCase()}`)
  }
  return user
}

export async function requireTvCurationForUser(
  user: User,
  disciplineSlug: string,
  requirement: AuthorizationRequirement = "taxonomy.use",
): Promise<User> {
  const snapshot = await getAuthorizationSnapshot(user.id)
  if (hasRole(snapshot, "admin")) return user
  if (!hasTvCuratorRole(snapshot)) throw new AuthorizationError("FORBIDDEN")
  if (!hasPermission(snapshot, requirement)) {
    throw new AuthorizationError("FORBIDDEN")
  }
  const legacyBypass = env.LEGACY_CURATOR_BYPASS
  if (hasRole(snapshot, "curator")) {
    const { log } = await import("@/lib/utils/log")
    log.warn("auth.legacy_curator_bypass", { userId: user.id, scope: "tv", disciplineSlug: disciplineSlug.toLowerCase() })
    if (legacyBypass) return user
  }
  if (!hasDisciplineScope(snapshot, disciplineSlug)) {
    throw new AuthorizationError("FORBIDDEN", `Missing TV curation scope for discipline ${disciplineSlug.toLowerCase()}`)
  }
  return user
}

export async function requireAdministratorForUser(user: User): Promise<User> {
  return requireRoleForUser(user, "admin")
}
