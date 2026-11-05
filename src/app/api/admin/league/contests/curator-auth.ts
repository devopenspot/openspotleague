import { NextResponse } from "next/server"
import type { User } from "@/lib/auth/user"
import {
  authorizationErrorResponse,
  requireContestCurationAccess,
} from "@/lib/auth/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import {
  CountryScopeError,
  resolveScopeCountryCode,
} from "@/lib/services/country-scope"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import type { AuthorizationRequirement } from "@/lib/services/profile/authorization"
import { getContestCountryCode } from "@/lib/services/league"

/**
 * Contest-curation guards: every curator route is scoped to the contest's
 * country (contest_curator) or open to admins. Returns the user, or the
 * response to send.
 */

export const CURATE: AuthorizationRequirement = "league.curate"
export const CURATE_MEDIA: AuthorizationRequirement = ["league.curate", "media.manage"]

function guardError(error: unknown): NextResponse {
  if (isAuthorizationError(error)) return authorizationErrorResponse(error)
  if (error instanceof CountryScopeError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return leagueErrorResponse(error)
}

/** Scope check against a country the request names (create, country edits). */
export async function authorizeCuratorForCountry(
  input: { countryCode?: string; country?: string },
  requirement: AuthorizationRequirement = CURATE,
): Promise<User | NextResponse> {
  try {
    const countryCode = await resolveScopeCountryCode(input)
    return await requireContestCurationAccess(countryCode, requirement)
  } catch (error) {
    return guardError(error)
  }
}

/** Scope check against an existing contest's country. */
export async function authorizeCuratorForContest(
  eventId: string,
  requirement: AuthorizationRequirement = CURATE,
): Promise<User | NextResponse> {
  try {
    const countryCode = await getContestCountryCode(eventId)
    if (!countryCode) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 })
    }
    return await requireContestCurationAccess(countryCode, requirement)
  } catch (error) {
    return guardError(error)
  }
}
