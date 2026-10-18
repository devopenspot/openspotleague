import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, privateNoCache } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../../errors"
import { getLeagueEventDashboard } from "@/lib/services/league"

/**
 * Organizer live + historic metrics (counts, run progress, per-judge
 * submissions, per-criterion averages, payment state). Non-organizer
 * members and anonymous callers get 404-shaped responses so presence
 * is not disclosed.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
  try {
    const dashboard = await getLeagueEventDashboard(id, user.id)
    if (!dashboard) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }
    return NextResponse.json(dashboard, { headers: privateNoCache() })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
