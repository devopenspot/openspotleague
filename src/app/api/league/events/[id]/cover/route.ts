import type { NextRequest } from "next/server"
import { leagueUnauthorized } from "@/app/api/league/helpers"
import { handleCoverClear, handleCoverUpload } from "@/app/api/league/cover-handlers"
import { getSessionUser } from "@/lib/auth/server"
import { assertCanEditContest } from "@/lib/services/league"
import { leagueErrorResponse } from "../../../errors"
import { enforceLeagueRateLimit } from "../../../rate-limit"

/**
 * Contest cover (organizers, `config.edit`). POST takes multipart
 * `{ image, expectedVersion, idempotencyKey }`: the file is stored in the R2
 * events bucket first, then `setContestCover` swaps `image_url` in a
 * versioned transaction. DELETE takes JSON `{ expectedVersion,
 * idempotencyKey }` and falls back to the designed cover.
 */

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
  return handleCoverUpload(request, {
    eventId: id,
    actorId: user.id,
    authorize: () => assertCanEditContest(id, user.id),
  })
}

export async function DELETE(
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
  return handleCoverClear(request, { eventId: id, actorId: user.id })
}
