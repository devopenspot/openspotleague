import "server-only"

import type { User } from "@/lib/auth/user"
import { log } from "@/lib/utils/log"
import {
  getAuthorizationSnapshotCached,
  hasAnyRole,
  hasPermission,
  hasRole,
  hasSpotCuratorRole,
  hasEventCuratorRole,
  hasTrickCuratorRole,
  hasTvCuratorRole,
} from "@/lib/services/profile/authorization"
import { ensurePreferenceProfile } from "@/lib/services/profile/preferences"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

function getAdminClient() {
  try {
    return getSupabaseAdminClient()
  } catch {
    return null
  }
}

export { getAdminClient }

export interface AuthClaims {
  sub?: string
  email?: string
  user_metadata?: Record<string, unknown>
}

/**
 * Pure projection of a Supabase JWT payload to a {@link User}. Called from
 * the cookie reader and the OAuth callback so they cannot drift.
 */
export function userFromClaims(claims: AuthClaims): User | null {
  if (!claims.sub) return null
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const email = (typeof claims.email === "string" && claims.email) || ""
  const name =
    (typeof meta["display_name"] === "string" && meta["display_name"]) ||
    (typeof meta["full_name"] === "string" && meta["full_name"]) ||
    (typeof meta["name"] === "string" && meta["name"]) ||
    email.split("@")[0] ||
    "Scout"
  const initials =
    (typeof meta["initials"] === "string" && meta["initials"]) ||
    name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") ||
    "OS"
  const avatarUrl =
    (typeof meta["avatar_url"] === "string" && meta["avatar_url"]) ||
    (typeof meta["picture"] === "string" && meta["picture"]) ||
    null
  return {
    id: claims.sub,
    name,
    email,
    initials,
    avatarUrl,
    canAccessAdmin: false,
    canCurate: false,
    isAdministrator: false,
    canCurateSpots: false,
    canCurateEvents: false,
    canCurateTricks: false,
    canManageLeague: false,
    curatedCountryCodes: [],
    curatedDisciplineSlugs: [],
  }
}

export async function getServerUserFromCookies(): Promise<User | null> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server")
    const supabase = await createSupabaseServerClient()
    // getClaims validates the session cookie's JWT (locally with the JWKS
    // for asymmetric keys, via the auth server for symmetric). It does not
    // make a network round trip to fetch the full user record on every
    // request, unlike getUser(). The user_metadata we need for display
    // (name, initials, avatar) is embedded in the JWT payload.
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) return null
    const fromClaims = userFromClaims(data.claims as AuthClaims)
    if (!fromClaims) return null
    const authorization = await getAuthorizationSnapshotCached(fromClaims.id)
    const isAdministrator = hasRole(authorization, "admin")
    const isCurator = hasRole(authorization, "curator")
    const canCurate =
      isAdministrator ||
      (isCurator && hasPermission(authorization, [
        "content.write",
        "media.manage",
        "taxonomy.use",
      ])) ||
      hasAnyRole(authorization, ["spot_curator", "event_curator", "trick_curator", "tv_curator"] as const)
    const curatedCountryCodes = [...authorization.countryScopes]
    const curatedDisciplineSlugs = [...authorization.disciplineScopes]
    const canCurateSpots = isAdministrator || hasSpotCuratorRole(authorization)
    const canCurateEvents = isAdministrator || hasEventCuratorRole(authorization)
    const canCurateTricks = isAdministrator || hasTrickCuratorRole(authorization)
    const canCurateTv = isAdministrator || hasTvCuratorRole(authorization)
    const canManageLeague = isAdministrator || hasPermission(authorization, "league.manage")
    return {
      ...fromClaims,
      canAccessAdmin:
        isAdministrator ||
        (hasAnyRole(authorization, ["admin", "curator", "spot_curator", "event_curator", "trick_curator", "tv_curator"] as const) &&
          hasPermission(authorization, "content.read")),
      canCurate,
      isAdministrator,
      canCurateSpots,
      canCurateEvents,
      canCurateTricks,
      canCurateTv,
      canManageLeague,
      curatedCountryCodes,
      curatedDisciplineSlugs,
    }
  } catch {
    return null
  }
}

export async function ensureProfileRow(user: User): Promise<void> {
  try {
    await ensurePreferenceProfile(user)
  } catch {
    log.error("auth: profile provisioning failed", { userId: user.id })
    throw new Error("Profile provisioning failed")
  }
}
