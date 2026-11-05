import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, leagueInvalidJson, leagueInvalidBody } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { enforceLeagueRateLimit } from "@/app/api/league/rate-limit"
import { updateMyEntry } from "@/lib/services/league"
import { leagueEntryUpdateInputSchema } from "@/lib/schemas/league"

/** Riders change their divisions and category while registration is open. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
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
  const parsed = leagueEntryUpdateInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await updateMyEntry(user.id, {
      eventId: id,
      entry: parsed.data.entry,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
