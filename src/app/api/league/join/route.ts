import { NextResponse, type NextRequest } from "next/server"
import { leagueInvalidBody, leagueInvalidJson, leagueUnauthorized } from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../errors"
import { enforceLeagueRateLimit } from "../rate-limit"
import { joinEventByCode } from "@/lib/services/league"
import { leagueJoinInputSchema } from "@/lib/schemas/league"

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  try {
    // Joins are shareable-link traffic: tighter IP bucket than other actions.
    enforceLeagueRateLimit(request, user.id, { ipMax: 10 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = leagueJoinInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  // Body key is canonical (spec); the header stays as a fallback.
  try {
    const result = await joinEventByCode(user.id, parsed.data.code, {
      idempotencyKey:
        parsed.data.idempotencyKey ??
        request.headers.get("x-idempotency-key") ??
        undefined,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
