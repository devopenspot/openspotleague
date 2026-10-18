import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, leagueInvalidJson, leagueInvalidBody } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../../../errors"
import { enforceLeagueRateLimit } from "../../../../rate-limit"
import { revokeEventInvite } from "@/lib/services/league"
import { leagueMutationInputSchema } from "@/lib/schemas/league"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; inviteId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id, inviteId } = await context.params
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
  const parsed = leagueMutationInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await revokeEventInvite(user.id, {
      eventId: id,
      inviteId,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
