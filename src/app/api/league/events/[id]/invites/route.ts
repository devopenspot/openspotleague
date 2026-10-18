import { NextResponse, type NextRequest } from "next/server"
import { leagueUnauthorized, leagueInvalidJson, leagueInvalidBody } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../../errors"
import { enforceLeagueRateLimit } from "../../../rate-limit"
import { createEventInvite } from "@/lib/services/league"
import { leagueInviteInputSchema } from "@/lib/schemas/league"

export async function POST(
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
  const parsed = leagueInviteInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await createEventInvite(user.id, {
      eventId: id,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      role: parsed.data.role,
      expiresInDays: parsed.data.expiresInDays,
      maxUses: parsed.data.maxUses,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
