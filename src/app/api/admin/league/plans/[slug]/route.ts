import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { updateEventPlan } from "@/lib/services/league"
import { leaguePlanPatchSchema } from "@/lib/schemas/league"

/** Edit-only plan patch (slug immutable; new pricing ships as a new slug). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  let user
  try {
    user = await requireCurationAccess("league.manage")
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error)
    return leagueErrorResponse(error)
  }
  const { slug } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = leaguePlanPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const plan = await updateEventPlan(user.id, slug, parsed.data)
    return NextResponse.json(plan)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
