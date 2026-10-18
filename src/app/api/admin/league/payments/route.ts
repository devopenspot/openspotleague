import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { privateNoCache } from "@/app/api/league/helpers"
import { listLeaguePayments } from "@/lib/services/league"
import type { EventPaymentStatus } from "@/types/sport-events"

const STATUS_FILTERS: ReadonlySet<EventPaymentStatus> = new Set([
  "pending",
  "paid",
  "comped",
  "refunded",
  "failed",
])

/**
 * Admin payment queue (`league.manage`): latest event payments with event +
 * payer context for the mark-paid/comp/refund workflow.
 */
export async function GET(request: NextRequest) {
  try {
    await requireCurationAccess("league.manage")
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error)
    return leagueErrorResponse(error)
  }
  try {
    const statusParam = request.nextUrl.searchParams.get("status")
    const status =
      statusParam && STATUS_FILTERS.has(statusParam as EventPaymentStatus)
        ? [statusParam as EventPaymentStatus]
        : undefined
    const items = await listLeaguePayments({ status })
    return NextResponse.json({ items }, { headers: privateNoCache() })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
