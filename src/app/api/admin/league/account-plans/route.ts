import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import { leagueErrorResponse } from "@/app/api/league/errors"
import {
  grantAccountPlan,
  listAccountPlans,
  revokeAccountPlan,
} from "@/lib/services/league"
import { leagueAccountPlanActionSchema } from "@/lib/schemas/league"

/**
 * Account-plan grants (spec `GET/PATCH /api/admin/league/account-plans`):
 * search grants with user context; grant/switch or revoke a user's plan.
 * Revoked users fall back to the default/free caps.
 */
export async function GET(request: NextRequest) {
  try {
    await requireCurationAccess("league.manage")
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error)
    return leagueErrorResponse(error)
  }
  try {
    const search = request.nextUrl.searchParams.get("search") ?? undefined
    const items = await listAccountPlans({ search })
    return NextResponse.json({ items })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
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
  const parsed = leagueAccountPlanActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const result =
      parsed.data.action === "revoke"
        ? await revokeAccountPlan(parsed.data.userId)
        : await grantAccountPlan(user.id, {
            userId: parsed.data.userId,
            planSlug: parsed.data.planSlug!,
          })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
