import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, privateNoCache } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../../errors"
import { getMyEventHistory } from "@/lib/services/league"

/**
 * Per-event history for the signed-in member: riders get their runs +
 * published result, judges their submissions, organizers a light summary.
 * Non-members get 404 (presence is not disclosed).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
  try {
    const history = await getMyEventHistory(id, user.id)
    if (!history) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }
    return NextResponse.json(history, { headers: privateNoCache() })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
