import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, leagueInvalidJson, leagueInvalidBody } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { enforceLeagueRateLimit } from "@/app/api/league/rate-limit"
import { submitRunVideo } from "@/lib/services/league"
import { leagueRunVideoInputSchema } from "@/lib/schemas/league"

/**
 * Video contests: the run's own rider submits (or replaces) the video link
 * while the contest is live and before the deadline. Street runs also need
 * the best-trick link. Locked once a judge scored the run.
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
  const parsed = leagueRunVideoInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await submitRunVideo(user.id, {
      eventId: id,
      runId,
      videoUrl: parsed.data.videoUrl,
      bestTrickVideoUrl: parsed.data.bestTrickVideoUrl,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
