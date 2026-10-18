import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { markLeaguePayment } from "@/lib/services/league"
import { leagueAdminPaymentActionSchema } from "@/lib/schemas/league"

/**
 * Admin transition for event payments (`league.manage` permission): mark a
 * pending payment as paid/comped to unlock the event plan (and raise the
 * payer's account plan), or refunded/failed. Refunds never auto-downgrade.
 * PATCH is the spec-conformant alias of POST.
 */
async function transition(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requireCurationAccess("league.manage")
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error)
    return leagueErrorResponse(error)
  }
  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = leagueAdminPaymentActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const result = await markLeaguePayment(user.id, {
      paymentId: id,
      status: parsed.data.status,
      providerReference: parsed.data.providerReference,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export const POST = transition

export const PATCH = transition
