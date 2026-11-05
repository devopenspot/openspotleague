import { NextResponse, type NextRequest } from "next/server"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { getContestStandings } from "@/lib/services/league/standings"

/**
 * Contest standings. Published standings of public contests are open to
 * everyone; otherwise active members only (provisional = panel totals only).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  try {
    const user = await getSessionUser()
    const standings = await getContestStandings(id, user?.id ?? null)
    if (!standings) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }
    return NextResponse.json(standings, {
      headers: { "cache-control": "private, no-store" },
    })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
