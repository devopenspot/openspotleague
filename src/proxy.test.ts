import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import {
  hasSessionCookiesFromNames,
  isPrefetchRequest,
  isProxyBypassPath,
  isTvEmbedPath,
  isUnrecoverableAuthError,
  matchRateLimitTier,
  needsSeedForPath,
} from "./proxy"

describe("isTvEmbedPath", () => {
  it("matches the TV root and nested paths", () => {
    expect(isTvEmbedPath("/tv")).toBe(true)
    expect(isTvEmbedPath("/tv/skateboard")).toBe(true)
  })

  it("does not match lookalike paths", () => {
    expect(isTvEmbedPath("/tvx")).toBe(false)
    expect(isTvEmbedPath("/api/tv")).toBe(false)
    expect(isTvEmbedPath("/")).toBe(false)
  })
})

describe("matchRateLimitTier", () => {
  it("picks the first matching tier (admin before public-read)", () => {
    expect(matchRateLimitTier("/api/admin/users")?.tag).toBe("admin-api")
    expect(matchRateLimitTier("/api/auth/signout")?.tag).toBe("auth")
    expect(matchRateLimitTier("/api/games/g1/next-trick")?.tag).toBe("games")
    expect(matchRateLimitTier("/api/weather")?.tag).toBe("weather")
    expect(matchRateLimitTier("/api/health")?.tag).toBe("health")
  })

  it("matches profile-read endpoints", () => {
    expect(matchRateLimitTier("/api/saved-spots")?.tag).toBe("profile-read")
    expect(matchRateLimitTier("/api/verified-spots/sp1")?.tag).toBe("profile-read")
  })

  it("gates the public-read tier behind RATE_LIMIT_PUBLIC_ENABLED", () => {
    const previous = process.env.RATE_LIMIT_PUBLIC_ENABLED
    try {
      delete process.env.RATE_LIMIT_PUBLIC_ENABLED
      expect(matchRateLimitTier("/api/spots")?.tag).toBeUndefined()

      process.env.RATE_LIMIT_PUBLIC_ENABLED = "true"
      expect(matchRateLimitTier("/api/spots")?.tag).toBe("public-read")
      expect(matchRateLimitTier("/api/spots/sp1")?.tag).toBe("public-read")
      expect(matchRateLimitTier("/api/geocode/reverse")?.tag).toBe("public-read")
    } finally {
      if (previous === undefined) delete process.env.RATE_LIMIT_PUBLIC_ENABLED
      else process.env.RATE_LIMIT_PUBLIC_ENABLED = previous
    }
  })

  it("returns null for unmatched paths", () => {
    expect(matchRateLimitTier("/")).toBeNull()
    expect(matchRateLimitTier("/map")).toBeNull()
    expect(matchRateLimitTier("/profile")).toBeNull()
  })

  it("matches the tv tier", () => {
    expect(matchRateLimitTier("/api/tv")?.tag).toBe("tv")
    expect(matchRateLimitTier("/api/tv?discipline=skateboard")?.tag).toBe("tv")
    expect(matchRateLimitTier("/api/tv?limit=12&cursor=abc")?.tag).toBe("tv")
  })

  it("matches the stricter tv-ids tier before the generic tv tier", () => {
    const tier = matchRateLimitTier("/api/tv/ids?discipline=roller")
    expect(tier?.tag).toBe("tv-ids")
    expect(tier?.limit).toBe(20)
  })
})

describe("isProxyBypassPath", () => {
  it("bypasses health and static/infra paths", () => {
    expect(isProxyBypassPath("/api/health")).toBe(true)
    expect(isProxyBypassPath("/robots.txt")).toBe(true)
    expect(isProxyBypassPath("/sitemap.xml")).toBe(true)
    expect(isProxyBypassPath("/manifest.webmanifest")).toBe(true)
    expect(isProxyBypassPath("/icon")).toBe(true)
    expect(isProxyBypassPath("/apple-icon")).toBe(true)
  })

  it("does not bypass app or api paths", () => {
    expect(isProxyBypassPath("/")).toBe(false)
    expect(isProxyBypassPath("/map")).toBe(false)
    expect(isProxyBypassPath("/tv")).toBe(false)
    expect(isProxyBypassPath("/api/spots")).toBe(false)
    expect(isProxyBypassPath("/api/tv")).toBe(false)
  })
})

describe("hasSessionCookiesFromNames", () => {
  it("detects supabase auth-token cookies", () => {
    expect(hasSessionCookiesFromNames(["sb-abc-auth-token"])).toBe(true)
    expect(
      hasSessionCookiesFromNames(["other", "sb-abc-auth-token-code-verifier"]),
    ).toBe(true)
  })

  it("returns false for anonymous traffic", () => {
    expect(hasSessionCookiesFromNames([])).toBe(false)
    expect(hasSessionCookiesFromNames(["osp_seed", "other"])).toBe(false)
  })
})

describe("needsSeedForPath", () => {
  it("seeds only landing pages", () => {
    expect(needsSeedForPath("/")).toBe(true)
    expect(needsSeedForPath("/explore")).toBe(true)
  })

  it("leaves api, tv, and map seed-free for CDN cacheability", () => {
    expect(needsSeedForPath("/api/spots")).toBe(false)
    expect(needsSeedForPath("/api/weather")).toBe(false)
    expect(needsSeedForPath("/tv")).toBe(false)
    expect(needsSeedForPath("/map")).toBe(false)
  })
})

describe("isPrefetchRequest", () => {
  it("detects Next.js router prefetch header", () => {
    const req = new NextRequest("http://localhost/explore", {
      headers: { "next-router-prefetch": "1" },
    })
    expect(isPrefetchRequest(req)).toBe(true)
  })

  it("detects Purpose: prefetch", () => {
    const req = new NextRequest("http://localhost/explore", {
      headers: { purpose: "prefetch" },
    })
    expect(isPrefetchRequest(req)).toBe(true)
  })

  it("detects Sec-Purpose: prefetch", () => {
    const req = new NextRequest("http://localhost/explore")
    req.headers.set("sec-purpose", "prefetch")
    expect(isPrefetchRequest(req)).toBe(true)
  })

  it("detects X-Purpose: prefetch", () => {
    const req = new NextRequest("http://localhost/explore", {
      headers: { "x-purpose": "prefetch" },
    })
    expect(isPrefetchRequest(req)).toBe(true)
  })

  it("returns false for standard navigation", () => {
    const req = new NextRequest("http://localhost/explore")
    expect(isPrefetchRequest(req)).toBe(false)
  })
})

describe("isUnrecoverableAuthError", () => {
  it("identifies status 400 as unrecoverable", () => {
    expect(isUnrecoverableAuthError({ status: 400 })).toBe(true)
  })

  it("identifies invalid_grant or invalid refresh token as unrecoverable", () => {
    expect(isUnrecoverableAuthError({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toBe(true)
    expect(isUnrecoverableAuthError({ message: "invalid_grant" })).toBe(true)
  })

  it("identifies 5xx and network errors as recoverable", () => {
    expect(isUnrecoverableAuthError({ status: 500, message: "Internal server error" })).toBe(false)
    expect(isUnrecoverableAuthError({ status: 503, message: "Service unavailable" })).toBe(false)
    expect(isUnrecoverableAuthError({ message: "fetch failed" })).toBe(false)
  })
})
