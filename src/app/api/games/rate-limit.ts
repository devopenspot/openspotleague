import { GameDomainError } from "@/lib/games/definitions"
import type { Identity } from "@/lib/games/guest"
import { clientIp, isRateLimited, rateLimitKey } from "@/lib/api/rate-limit"

/**
 * Rate limit for game mutation routes (spec 13.1: server-side rate
 * limits apply to guests and authenticated users alike).
 *
 * Two tiers are enforced per request:
 * - an identity bucket (60/min) keyed on the session user, guest token,
 *   or "anonymous";
 * - an IP bucket (120/min) keyed on the client IP, so a caller that
 *   rotates self-minted guest tokens cannot bypass the limit entirely.
 */

const IP_MAX_REQUESTS_PER_WINDOW = 120

export function enforceRateLimit(request: Request, identity: Identity) {
  const identityKey = identity.userId ?? identity.guestToken ?? "anonymous"
  const ipKey = clientIp(request)
  if (isRateLimited(rateLimitKey("games", "id", identityKey))) {
    throw new GameDomainError("RATE_LIMITED", "Too many requests. Try again shortly.")
  }
  if (isRateLimited(rateLimitKey("games", "ip", ipKey), IP_MAX_REQUESTS_PER_WINDOW)) {
    throw new GameDomainError("RATE_LIMITED", "Too many requests. Try again shortly.")
  }
}
