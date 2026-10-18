import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import { leagueErrorResponse } from "@/app/api/league/errors"
import {
  createEventPlan,
  listEventPlans,
} from "@/lib/services/league"
import { leaguePlanCreateInputSchema } from "@/lib/schemas/league"

/** Plan table (GET) for `league.manage`; POST ships a new pricing tier. */
export async function GET() {
  try {
    await requireCurationAccess("league.manage")
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error)
    return leagueErrorResponse(error)
  }
  try {
    const items = await listEventPlans()
    return NextResponse.json({ items })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireCurationAccess("league.manage")
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error)
    return leagueErrorResponse(error)
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = leaguePlanCreateInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const plan = await createEventPlan(user.id, parsed.data)
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
