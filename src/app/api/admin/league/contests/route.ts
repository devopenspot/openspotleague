import { NextResponse, type NextRequest } from "next/server"
import { getServerUserFromCookies } from "@/lib/auth/auth"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { leagueInvalidBody, leagueInvalidJson } from "@/app/api/league/helpers"
import { curatorCreateContestInputSchema } from "@/lib/schemas/league"
import {
  createLeagueEvent,
  listContestsForCuration,
  type ContestCurationQuery,
} from "@/lib/services/league"
import { authorizeCuratorForCountry } from "./curator-auth"

/**
 * Contest curation collection (`league.curate`).
 * GET lists every contest in the caller's country scope (admins: all), any
 * plan, visibility or status. POST creates a curated contest: the curator is
 * main organizer, the chosen plan is comped (gate settled), and it may be
 * listed publicly and featured.
 */

const VISIBILITIES = new Set(["public", "unlisted"])

export async function GET(request: NextRequest) {
  const user = await getServerUserFromCookies()
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  if (!user.canCurateContests) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const params = request.nextUrl.searchParams
  const visibility = params.get("visibility")
  const featured = params.get("featured")
  const query: ContestCurationQuery = {
    q: params.get("q") ?? undefined,
    planSlug: params.get("plan") ?? undefined,
    status: params.get("status") ?? undefined,
    countryCode: params.get("country") ?? undefined,
    visibility:
      visibility && VISIBILITIES.has(visibility)
        ? (visibility as "public" | "unlisted")
        : undefined,
    featured: featured === "true" ? true : featured === "false" ? false : undefined,
  }
  try {
    const items = await listContestsForCuration(
      user.isAdministrator ? null : (user.curatedCountryCodes ?? []),
      query,
    )
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "private, no-cache" } },
    )
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = curatorCreateContestInputSchema.safeParse(body)
  if (!parsed.success) return leagueInvalidBody(parsed.error)
  const { contest, planSlug, visibility, featured, idempotencyKey } = parsed.data

  const user = await authorizeCuratorForCountry({
    countryCode: contest.countryCode,
    country: contest.country,
  })
  if (user instanceof NextResponse) return user

  try {
    const result = await createLeagueEvent(user.id, contest, {
      idempotencyKey,
      curator: { planSlug, visibility, featured },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
