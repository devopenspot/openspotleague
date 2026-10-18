import "server-only"

import { isConnectionError, TimeoutError } from "@/lib/db/client"

export class CountryScopeError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "CountryScopeError"
    this.status = status
  }
}

/**
 * Resolve `countryCode` from explicit `countryCode` or `country` name.
 * - `countryCode` wins (uppercased).
 * - `country` name resolved via `lookupIso2ByName` (cached `countries:all`).
 * - Throws `CountryScopeError(400)` if neither yields a 2-letter code.
 * - Propagates `TimeoutError`/`isConnectionError` for caller to map to 503.
 */
export async function resolveScopeCountryCode(input: {
  countryCode?: string
  country?: string
}): Promise<string> {
  const code = input.countryCode?.trim().toUpperCase()
  if (code) {
    if (/^[A-Z]{2}$/.test(code)) return code
    throw new CountryScopeError("countryCode must be a 2-letter ISO code", 400)
  }
  const name = input.country?.trim()
  if (name) {
    const { lookupIso2ByName } = await import("@/lib/repositories/spot/country-repository")
    let iso2: string | null
    try {
      iso2 = await lookupIso2ByName(name)
    } catch (err) {
      if (err instanceof TimeoutError || isConnectionError(err)) throw err
      throw new CountryScopeError("countryCode is required", 400)
    }
    if (iso2) return iso2.toUpperCase()
    throw new CountryScopeError("countryCode is required", 400)
  }
  throw new CountryScopeError("countryCode is required", 400)
}
