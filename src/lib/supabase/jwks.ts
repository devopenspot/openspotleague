/**
 * Process-wide JWKS cache for `supabase.auth.getClaims()`.
 *
 * `@supabase/ssr` builds a fresh client per request, and auth-js only caches
 * the JWKS on the client instance, so with asymmetric signing keys every
 * request re-fetched `/auth/v1/.well-known/jwks.json` (each fetch is a Supabase
 * API-gateway log line → Logs Ingest). Passing the keys via `getClaims(undefined,
 * { jwks })` makes auth-js skip the network entirely. If a token's `kid` is not
 * in the cached set (key rotation), auth-js falls back to its own fetch, so
 * rotation self-heals.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/config/env"
import { perRequest } from "@/lib/utils/request-scope"

type GetClaimsOptions = NonNullable<Parameters<SupabaseClient["auth"]["getClaims"]>[1]>
export type CachedJwks = NonNullable<GetClaimsOptions["jwks"]>

// Supabase edge-caches the endpoint ~10 min; stay under that to honor rotation.
const JWKS_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 3_000
// After a failed fetch, don't retry on every request.
const FAILURE_BACKOFF_MS = 30 * 1000

let cached: { jwks: CachedJwks; expiresAt: number } | null = null
const getInflight = perRequest<{ fetch: Promise<CachedJwks | undefined> | null }>(() => ({ fetch: null }))
let retryAfter = 0

export function resetJwksCacheForTests(): void {
  cached = null
  getInflight().fetch = null
  retryAfter = 0
}

async function fetchJwks(url: string, apikey: string | null): Promise<CachedJwks | undefined> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`, {
      headers: apikey ? { apikey } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const body = (await res.json()) as { keys?: unknown }
    if (!Array.isArray(body.keys) || body.keys.length === 0) return undefined
    return { keys: body.keys as CachedJwks["keys"] }
  } catch {
    return undefined
  }
}

/**
 * Returns the cached JWKS (refreshing at most once per TTL, deduped across
 * concurrent callers), or `undefined` so callers fall back to default auth-js
 * behavior (symmetric keys, misconfiguration, upstream failure).
 */
export async function getCachedJwks(now: number = Date.now()): Promise<CachedJwks | undefined> {
  if (cached && cached.expiresAt > now) return cached.jwks
  const url = getSupabaseUrl()
  if (!url) return undefined
  if (now < retryAfter) return cached?.jwks
  const inflight = getInflight()
  if (!inflight.fetch) {
    inflight.fetch = fetchJwks(url, getSupabasePublishableKey())
      .then((jwks) => {
        if (jwks) {
          cached = { jwks, expiresAt: Date.now() + JWKS_TTL_MS }
        } else {
          retryAfter = Date.now() + FAILURE_BACKOFF_MS
        }
        return jwks ?? cached?.jwks
      })
      .finally(() => {
        inflight.fetch = null
      })
  }
  return inflight.fetch
}
