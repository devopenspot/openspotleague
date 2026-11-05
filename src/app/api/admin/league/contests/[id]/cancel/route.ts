import { NextResponse, type NextRequest } from "next/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { leagueInvalidBody, leagueInvalidJson } from "@/app/api/league/helpers"
import { curatorCancelInputSchema } from "@/lib/schemas/league"
import { cancelEvent } from "@/lib/services/league"
import { authorizeCuratorForContest } from "../../curator-auth"

/** Curator cancel: same lifecycle transition and member notifications. */
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
  const parsed = curatorCancelInputSchema.safeParse(body)
  if (!parsed.success) return leagueInvalidBody(parsed.error)
  const user = await authorizeCuratorForContest(id)
  if (user instanceof NextResponse) return user
  try {
    const result = await cancelEvent(
      user.id,
      {
        eventId: id,
        expectedVersion: parsed.data.expectedVersion,
        idempotencyKey: parsed.data.idempotencyKey,
      },
      { asCurator: true, reason: parsed.data.reason },
    )
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
