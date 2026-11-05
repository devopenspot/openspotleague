import { NextResponse, type NextRequest } from "next/server"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { leagueInvalidBody, leagueInvalidJson } from "@/app/api/league/helpers"
import { curatorContestPatchInputSchema } from "@/lib/schemas/league"
import {
  getContestForCuration,
  updateLeagueEventConfig,
} from "@/lib/services/league"
import {
  authorizeCuratorForContest,
  authorizeCuratorForCountry,
} from "../curator-auth"

/**
 * One contest for curators. GET returns the full contest state (members,
 * runs, results, payment gate) without needing membership. PATCH moderates
 * details, links and `featured` through the league config writer
 * (`asCurator`), with an optional reason kept in the action log.
 */

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await authorizeCuratorForContest(id)
  if (user instanceof NextResponse) return user
  try {
    const state = await getContestForCuration(id, user.id)
    if (!state) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 })
    }
    return NextResponse.json(state, {
      headers: { "Cache-Control": "private, no-cache" },
    })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export async function PATCH(
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
  const parsed = curatorContestPatchInputSchema.safeParse(body)
  if (!parsed.success) return leagueInvalidBody(parsed.error)

  const user = await authorizeCuratorForContest(id)
  if (user instanceof NextResponse) return user
  // Moving a contest to another country needs scope there too.
  const { patch } = parsed.data
  if (patch.countryCode !== undefined) {
    const target = await authorizeCuratorForCountry({
      countryCode: patch.countryCode,
      country: patch.country,
    })
    if (target instanceof NextResponse) return target
  }

  try {
    const result = await updateLeagueEventConfig(
      user.id,
      {
        eventId: id,
        expectedVersion: parsed.data.expectedVersion,
        idempotencyKey: parsed.data.idempotencyKey,
        patch,
      },
      { asCurator: true, reason: parsed.data.reason },
    )
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
