import { NextResponse, type NextRequest } from "next/server"
import { getSessionUser } from "@/lib/auth/server"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { GameDomainError } from "@/lib/games/definitions"
import {
  GUEST_NAME_HEADER,
  GUEST_TOKEN_HEADER,
  isValidGuestToken,
  normalizeGuestName,
  type Identity,
} from "@/lib/games/guest"

/**
 * Resolves the actor identity for game API routes (spec section 18.2):
 * - Authenticated requests use the existing session cookie.
 * - Guest training requests use `x-guest-token` and `x-guest-name`.
 * - Guest headers on a request with an authenticated session are rejected as
 *   conflicting identity claims.
 * - Anonymous callers are only accepted when `allowAnonymous` is set (used for
 *   training share-code reads).
 */
export async function resolveIdentity(
  request: NextRequest,
  options: { allowAnonymous?: boolean } = {},
): Promise<Identity> {
  const tokenHeader = request.headers.get(GUEST_TOKEN_HEADER)
  const nameHeader = request.headers.get(GUEST_NAME_HEADER)
  const hasGuestHeaders = tokenHeader !== null || nameHeader !== null

  const user = await getSessionUser()

  if (hasGuestHeaders && user) {
    throw new GameDomainError(
      "NOT_AUTHORIZED",
      "Conflicting identity claims: an authenticated session cannot be combined with guest headers",
    )
  }
  if (hasGuestHeaders) {
    if (!tokenHeader || !isValidGuestToken(tokenHeader)) {
      throw new GameDomainError("NOT_AUTHORIZED", "A valid guest token is required")
    }
    if (nameHeader !== null) {
      const name = normalizeGuestName(nameHeader)
      if (!name) {
        throw new GameDomainError(
          "INVALID_INPUT",
          "The guest name must be 1 to 30 characters without control characters",
        )
      }
      return { userId: null, guestToken: tokenHeader, name }
    }
    return { userId: null, guestToken: tokenHeader, name: "" }
  }
  if (user) return { userId: user.id, guestToken: null, name: user.name }
  if (options.allowAnonymous) return { userId: null, guestToken: null, name: "" }
  throw new GameDomainError("NOT_AUTHORIZED", "Authentication required")
}

export async function resolveAuthenticatedIdentity(request: NextRequest): Promise<Identity> {
  const identity = await resolveIdentity(request)
  if (!identity.userId && !identity.guestToken) {
    throw new GameDomainError("NOT_AUTHORIZED", "Authentication required")
  }
  return identity
}

export function identityErrorResponse(error: unknown) {
  if (error instanceof GameDomainError) {
    const status = error.code === "NOT_AUTHORIZED" && error.message === "Authentication required"
      ? 401
      : DOMAIN_ERROR_STATUS[error.code] ?? 401
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  NOT_AUTHORIZED: 403,
  RATE_LIMITED: 429,
  STALE_VERSION: 409,
  IDEMPOTENCY_REUSE: 409,
  INVALID_TRANSITION: 409,
  PLAYER_NOT_ELIGIBLE: 409,
  DUPLICATE_ATTEMPT: 409,
  NO_COMPATIBLE_TRICK: 409,
  IDENTITY_CONFLICT: 403,
  IDEMPOTENCY_CONFLICT: 409,
}

/**
 * Single canonical GameDomainError → HTTP mapping shared by every game
 * route, so status codes cannot drift between endpoints. Transient DB
 * failures (timeouts, including waits for a DB gate slot, and connection
 * errors) map to 503 like `leagueErrorResponse`.
 */
export function gameErrorResponse(error: unknown, onInternalError?: () => void) {
  if (error instanceof GameDomainError) {
    const status = DOMAIN_ERROR_STATUS[error.code] ?? 409
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  if (error instanceof TimeoutError || isConnectionError(error)) {
    return NextResponse.json(
      { error: "The games service is temporarily unavailable", code: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    )
  }
  onInternalError?.()
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}
