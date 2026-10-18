import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, leagueInvalidJson, leagueInvalidBody } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { enforceLeagueRateLimit } from "@/app/api/league/rate-limit"
import { submitRunScore } from "@/lib/services/league"
import { leagueScoreInputSchema } from "@/lib/schemas/league"

/**
 * Judge score submission (capability `scores.submit`; organizers judge
 * implicitly): valid only inside an open judging window, validated against
 * the event's active scoring criteria. Resubmission upserts.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; runId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id, runId } = await context.params
  try {
    enforceLeagueRateLimit(request, user.id)
  } catch (error) {
    return leagueErrorResponse(error)
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = leagueScoreInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await submitRunScore(user.id, {
      eventId: id,
      runId,
      scores: parsed.data.scores,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
