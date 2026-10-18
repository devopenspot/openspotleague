import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, leagueInvalidJson, leagueInvalidBody } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { enforceLeagueRateLimit } from "@/app/api/league/rate-limit"
import { setRunWindow } from "@/lib/services/league"
import { leagueRunWindowInputSchema } from "@/lib/schemas/league"

/**
 * Judge-run window control (organizer capability `event.flow`):
 * `open` starts a judging window, `extend` pushes the end, `close`
 * finalizes the run as scored (when scores exist) or skipped.
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
  const parsed = leagueRunWindowInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await setRunWindow(user.id, {
      eventId: id,
      runId,
      mode: parsed.data.mode,
      windowMinutes: parsed.data.windowMinutes ?? (parsed.data.mode === "close" ? 0 : 10),
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
