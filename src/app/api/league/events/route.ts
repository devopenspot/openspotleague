import { NextResponse, type NextRequest } from "next/server"
import {
  leagueInvalidBody,
  leagueInvalidJson,
  leagueUnauthorized,
  privateNoCache,
} from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../errors"
import { enforceLeagueRateLimit } from "../rate-limit"
import {
  createLeagueEvent,
  listMyLeagueEvents,
} from "@/lib/services/league"
import { leagueCreateEventInputSchema } from "@/lib/schemas/league"
import { clientIp } from "@/lib/api/rate-limit"

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
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
  const parsed = leagueCreateEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  // The idempotency key is transport metadata — keep it out of the request
  // fingerprint. Body key is canonical; the header stays as a fallback.
  const { idempotencyKey, ...input } = parsed.data
  try {
    const result = await createLeagueEvent(user.id, input, {
      idempotencyKey: idempotencyKey ?? request.headers.get("x-idempotency-key") ?? undefined,
      ip: clientIp(request),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  try {
    return NextResponse.json(
      { items: await listMyLeagueEvents(user.id) },
      { headers: privateNoCache() },
    )
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
