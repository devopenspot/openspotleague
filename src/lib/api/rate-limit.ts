import { NextResponse } from "next/server"

/**
 * Shared in-memory sliding-window rate limiting for API route handlers.
 * Buckets are per-process (serverless instances get isolated counters),
 * which bounds abuse per running instance. Keys must be supplied by the
 * caller and scoped per route + identity.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 60
const MAX_BUCKETS = 10_000

const hits = new Map<string, number[]>()

export function clientIp(request: Request): string {
  // Cloudflare sets this on every request and overwrites client values. It must
  // come first: on Workers the other headers below are client-controlled.
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cloudflareIp) return cloudflareIp
  // x-vercel-forwarded-for is set by Vercel edge.
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for")
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  // Only trust x-forwarded-for first entry if Vercel proof headers present
  const fwd = request.headers.get("x-forwarded-for")
  const vercelIp = request.headers.get("x-vercel-ip-city") ?? request.headers.get("x-vercel-id")
  if (fwd && vercelIp) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  if (fwd && request.headers.get("x-vercel-id")) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  // Fallback: still use first entry but log — do not return unknown to avoid bypass
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  return "unknown"
}

export function rateLimitKey(...parts: Array<string | undefined>): string {
  return parts.filter((part) => part !== undefined && part.length > 0).join(":")
}

function recentForKey(key: string, now: number): number[] {
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS)
  hits.set(key, recent)
  return recent
}

/**
 * Records a hit for `key` and returns true when the request exceeds the
 * per-window allowance. `max` overrides the default per-window cap
 * (e.g. a looser IP-based tier).
 */
export function isRateLimited(key: string, max = MAX_REQUESTS_PER_WINDOW): boolean {
  const now = Date.now()
  const recent = recentForKey(key, now)
  if (recent.length >= max) {
    return true
  }
  recent.push(now)
  if (hits.size > MAX_BUCKETS) {
    for (const [bucketKey, timestamps] of hits) {
      if (timestamps.length === 0 || now - (timestamps[timestamps.length - 1] as number) >= WINDOW_MS) {
        hits.delete(bucketKey)
      }
    }
  }
  return false
}

export function rateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": "60" } },
  )
}
