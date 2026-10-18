import { NextResponse, type NextRequest } from "next/server"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../errors"
import { enforceLeagueRateLimit } from "../../rate-limit"
import {
  leagueInvalidBody,
  leagueInvalidJson,
  leagueNotModified,
  leagueRequestedVersion,
  leagueUnauthorized,
  privateNoCache,
} from "@/app/api/league/helpers"
import {
  getLeagueEventState,
  getLeagueEventVersion,
  updateLeagueEventConfig,
} from "@/lib/services/league"
import { leagueConfigPatchInputSchema } from "@/lib/schemas/league"

function notFound() {
  return NextResponse.json({ error: "Event not found" }, { status: 404 })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
  const requested = leagueRequestedVersion(request, `"event-${id}-`)
  if (requested.invalid) {
    return NextResponse.json({ error: "Invalid version" }, { status: 400 })
  }
  try {
    if (requested.knownVersion !== undefined) {
      const current = await getLeagueEventVersion(id, user.id)
      if (current !== null && current === requested.knownVersion) {
        return leagueNotModified(id, current)
      }
      if (current === null) return notFound()
    }
    const state = await getLeagueEventState(id, user.id)
    if (!state) return notFound()
    return NextResponse.json(state, {
      headers: {
        ETag: `"event-${id}-${state.event.version}"`,
        ...privateNoCache(),
      },
    })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

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
  const parsed = leagueConfigPatchInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    const result = await updateLeagueEventConfig(user.id, {
      eventId: id,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      patch: parsed.data.patch,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
