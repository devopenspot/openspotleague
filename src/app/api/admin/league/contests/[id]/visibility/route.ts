import { NextResponse, type NextRequest } from "next/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { leagueInvalidBody, leagueInvalidJson } from "@/app/api/league/helpers"
import { curatorVisibilityInputSchema } from "@/lib/schemas/league"
import { updateLeagueEventConfig } from "@/lib/services/league"
import { authorizeCuratorForContest } from "../../curator-auth"

/**
 * Hide a contest from the public listing (directory, map, search) or list
 * it again. Listing still needs an active paid/comped non-free plan
 * (VISIBILITY_REQUIRES_PAID_PLAN); hiding always works until the contest ends.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = curatorVisibilityInputSchema.safeParse(body)
  if (!parsed.success) return leagueInvalidBody(parsed.error)
  const user = await authorizeCuratorForContest(id)
  if (user instanceof NextResponse) return user
  try {
    const result = await updateLeagueEventConfig(
      user.id,
      {
        eventId: id,
        expectedVersion: parsed.data.expectedVersion,
        idempotencyKey: parsed.data.idempotencyKey,
        patch: { visibility: parsed.data.visibility },
      },
      { asCurator: true, reason: parsed.data.reason },
    )
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
