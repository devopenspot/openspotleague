import { clientIp, isRateLimited, rateLimitKey } from "@/lib/api/rate-limit"
import { LeagueDomainError } from "@/lib/league/definitions"

/**
 * Rate limits for league routes (games parity): an identity bucket (60/min)
 * keyed on the signed-in user plus an IP bucket (120/min). Join-style
 * endpoints add a tighter IP bucket via `enforceLeagueRateLimit(request, userId, { ipMax })`.
 */
const IDENTITY_MAX = 60
const IP_MAX = 120

export function enforceLeagueRateLimit(
  request: Request,
  userId: string,
  options?: { ipMax?: number },
): void {
  if (isRateLimited(rateLimitKey("league", "id", userId), IDENTITY_MAX)) {
    throw new LeagueDomainError("RATE_LIMITED", "Too many requests. Try again shortly.")
  }
  if (
    isRateLimited(
      rateLimitKey("league", "ip", clientIp(request)),
      options?.ipMax ?? IP_MAX,
    )
  ) {
    throw new LeagueDomainError("RATE_LIMITED", "Too many requests. Try again shortly.")
  }
}
