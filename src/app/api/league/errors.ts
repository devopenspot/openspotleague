import { NextResponse } from "next/server"
import { isLeagueDomainError, type LeagueErrorCode } from "@/lib/league/definitions"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { log } from "@/lib/utils/log"

const DOMAIN_ERROR_STATUS: Record<LeagueErrorCode, number> = {
  INVALID_INPUT: 400,
  SCORE_INVALID: 400,
  SCHEDULE_TOO_FAR_AHEAD: 400,
  NOT_AUTHORIZED: 403,
  STALE_VERSION: 409,
  INVALID_TRANSITION: 409,
  CAPACITY_EXCEEDED: 409,
  QUOTA_EXCEEDED: 409,
  ALREADY_MEMBER: 409,
  INVITE_INVALID: 409,
  INVITE_EXHAUSTED: 409,
  PAYMENT_EXISTS: 409,
  PAYMENT_NOT_FOUND: 404,
  RUN_WINDOW_CLOSED: 409,
  NOT_SCORED: 409,
  EMPTY_SCHEDULE: 409,
  EVENT_LOCKED: 409,
  EVENT_DISABLED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RATE_LIMITED: 429,
  PLAN_EXISTS: 409,
  PLAN_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
}

/**
 * League route error mapping (mirrors games' `gameErrorResponse`): typed
 * domain errors keep their code + message with a canonical status; transient
 * DB failures map to 503; everything else is logged and returns a generic
 * 500 — raw messages are never echoed to clients.
 */
export function leagueErrorResponse(error: unknown): NextResponse {
  if (isLeagueDomainError(error)) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: DOMAIN_ERROR_STATUS[error.code] },
    )
  }
  if (error instanceof TimeoutError || isConnectionError(error)) {
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "The league service is temporarily unavailable" },
      { status: 503 },
    )
  }
  log.error("api.league.internal_error", error instanceof Error ? error.message : error)
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}
