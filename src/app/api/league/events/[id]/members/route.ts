import { NextResponse, type NextRequest } from "next/server"
import {
  leagueInvalidBody,
  leagueInvalidJson,
  leagueUnauthorized,
  privateNoCache,
} from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../../errors"
import { enforceLeagueRateLimit } from "../../../rate-limit"
import { addEventMember, listEventMembers } from "@/lib/services/league"
import { leagueMemberAddInputSchema } from "@/lib/schemas/league"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
  try {
    return NextResponse.json(
      { items: await listEventMembers(user.id, id) },
      { headers: privateNoCache() },
    )
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

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
  const parsed = leagueMemberAddInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await addEventMember(user.id, {
      eventId: id,
      userId: parsed.data.userId,
      role: parsed.data.role,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
