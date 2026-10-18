import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { log } from "@/lib/utils/log"
import { clientIp, isRateLimited, rateLimitedResponse, rateLimitKey } from "@/lib/api/rate-limit"
import { securityHeaders, cspValue } from "@/lib/security/headers"

export function isTvEmbedPath(pathname: string): boolean {
  return pathname === "/tv" || pathname.startsWith("/tv/")
}

/** Static/infra paths that need no auth refresh, rate-limit, or seed. */
export function isProxyBypassPath(pathname: string): boolean {
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) return true
  return (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/icon" ||
    pathname === "/apple-icon"
  )
}

/** True when Supabase session cookies are present (anonymous traffic skips getClaims). */
export function hasSessionCookiesFromNames(names: readonly string[]): boolean {
  return names.some((n) => n.startsWith("sb-") && n.includes("-auth-token"))
}

/** Only landing pages consume osp_seed for random pagination. */
export function needsSeedForPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/explore" || pathname.startsWith("/explore/")
}

// Hoisted: static string, no env dependency (do not confuse with per-request env above).
const cachedCspReportOnly = cspValue()

type RateLimitTier = { match: (p: string) => boolean; limit: number; tag: string }

const RATE_LIMIT_TIERS: readonly RateLimitTier[] = [
  { match: (p) => p.startsWith("/api/admin"), limit: 60, tag: "admin-api" },
  { match: (p) => p.startsWith("/api/auth"), limit: 20, tag: "auth" },
  { match: (p) => p.startsWith("/api/games"), limit: 60, tag: "games" },
  { match: (p) => p.startsWith("/api/league"), limit: 60, tag: "league" },
  { match: (p) => p.startsWith("/api/notifications"), limit: 60, tag: "notifications" },
  { match: (p) => p.startsWith("/api/weather"), limit: 20, tag: "weather" },
  { match: (p) => p.startsWith("/api/health"), limit: 10, tag: "health" },
  // Ordered tiers — more specific matches first (first match wins).
  // /api/tv/ids gets a stricter tier below: lazy queue affordance makes
  // it rare, so scraping/scroll-loop bursts hit 429 before they can
  // burn Pooler egress through the id-list query.
  { match: (p) => p.startsWith("/api/tv/ids"), limit: 20, tag: "tv-ids" },
  { match: (p) => p.startsWith("/api/tv"), limit: 60, tag: "tv" },
  {
    match: (p) =>
      (process.env.RATE_LIMIT_PUBLIC_ENABLED === "true" || process.env.RATE_LIMIT_PUBLIC_ENABLED === "1") &&
      (p.startsWith("/api/spots") || p.startsWith("/api/events") || p.startsWith("/api/geocode")),
    limit: 60,
    tag: "public-read",
  },
  { match: (p) => p.startsWith("/api/saved-spots") || p.startsWith("/api/verified-spots") || p.startsWith("/api/spot-verifications"), limit: 60, tag: "profile-read" },
]

/** First tier whose matcher matches the path, or null when none apply. */
export function matchRateLimitTier(pathname: string): RateLimitTier | null {
  for (const tier of RATE_LIMIT_TIERS) {
    if (tier.match(pathname)) return tier
  }
  return null
}

function applySecurityHeaders(response: NextResponse, request?: NextRequest): void {
  for (const h of securityHeaders) response.headers.set(h.key, h.value)
  const tvPath = request ? isTvEmbedPath(request.nextUrl.pathname) : false
  if (tvPath) {
    response.headers.delete("X-Frame-Options")
    response.headers.delete("Cross-Origin-Opener-Policy")
    response.headers.delete("Cross-Origin-Resource-Policy")
    response.headers.set("Content-Security-Policy", "frame-ancestors *")
  } else {
    response.headers.set("Content-Security-Policy-Report-Only", cachedCspReportOnly)
  }
  // HSTS only in production – Vercel terminates TLS, so safe to send always in prod
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  }
}

export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID()
  // Per-request validated env (do not freeze at module scope — rotation/HMR)
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null
  const nextResponse = () => {
    const response = NextResponse.next({ request })
    response.headers.set("x-request-id", requestId)
    applySecurityHeaders(response, request)
    return response
  }

  // Static/infra paths skip rate-limit, seed, and Supabase entirely.
  // Handlers do their own auth where needed (e.g. detailed health).
  if (isProxyBypassPath(request.nextUrl.pathname)) {
    return nextResponse()
  }

  // Tiered rate-limit per IP (in-memory sliding window, per-instance).
  // Bypass in tests to keep handler unit tests deterministic.
  // Public-read tier gated by RATE_LIMIT_PUBLIC_ENABLED=false at launch ($0).
  if (process.env.NODE_ENV !== "test") {
    const pathname = request.nextUrl.pathname
    const tier = matchRateLimitTier(pathname)
    if (tier) {
      const key = rateLimitKey(tier.tag, clientIp(request))
      if (isRateLimited(key, tier.limit)) {
        log.warn("proxy: rate limited", { requestId, path: pathname, tier: tier.tag })
        const res = rateLimitedResponse()
        res.headers.set("x-request-id", requestId)
        applySecurityHeaders(res, request)
        return res
      }
    }
  }

  let response = nextResponse()

  // Seed for random pagination wire — 7-day SameSite=Lax, per-visit shuffle.
  // Lazy: only landing pages consume osp_seed. Other paths (API, /tv, /map)
  // must stay Set-Cookie-free so the CDN can cache anonymous responses.
  // Capture before Supabase so we can re-apply after response is replaced in setAll.
  let pendingSeed: string | null = null
  if (needsSeedForPath(request.nextUrl.pathname) && !request.cookies.get("osp_seed")?.value) {
    pendingSeed = crypto.randomUUID()
    // Seed the request so downstream Server Components see it in this same request.
    request.cookies.set("osp_seed", pendingSeed)
    response.cookies.set("osp_seed", pendingSeed, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    })
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return response
  }

  // Anonymous traffic (no session cookies) skips client alloc + JWT verify.
  // Authenticated pages/handlers still refresh via getClaims below, and do
  // their own cookie reads (getServerUserFromCookies) regardless.
  if (!hasSessionCookiesFromNames(request.cookies.getAll().map((c) => c.name))) {
    return response
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = nextResponse()
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        // Re-apply pending seed if response was replaced (Supabase refresh).
        if (pendingSeed) {
          response.cookies.set("osp_seed", pendingSeed, {
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
            sameSite: "lax",
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
          })
        }
      },
    },
  })

  // Refresh the session if needed. getClaims validates the cookie JWT
  // locally (asymmetric signing) or via the auth server (symmetric) — no
  // network round trip to fetch the full user record on every request.
  const { error } = await supabase.auth.getClaims()
  if (error) {
    log.warn("proxy: supabase.auth.getClaims failed", {
      requestId,
      message: error.message,
    })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*opengraph-image.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
