import { NextResponse } from "next/server"
import { checkDbHealth } from "@/lib/services/profile/health"
import { APP_VERSION } from "@/lib/config/system-info"
import {
  ensureRequestId,
  runWithRequestContext,
} from "@/lib/db/request-context"

export async function GET(request: Request) {
  const requestId = ensureRequestId(request.headers.get("x-request-id") ?? undefined)
  return runWithRequestContext(requestId, async () => {
    const url = new URL(request.url)
    const isDetailed = url.searchParams.get("detailed") === "1"
    if (isDetailed) {
      const { getAuthorizationSnapshot, hasRole } = await import("@/lib/services/profile/authorization")
      const { getServerUserFromCookies } = await import("@/lib/auth/auth")
      const user = await getServerUserFromCookies()
      if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "x-request-id": requestId, "Cache-Control": "private, no-store" } })
      try {
        const snap = await getAuthorizationSnapshot(user.id)
        if (!hasRole(snap, "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "x-request-id": requestId, "Cache-Control": "private, no-store" } })
      } catch {
        return NextResponse.json({ error: "Authorization unavailable" }, { status: 503, headers: { "x-request-id": requestId, "Cache-Control": "private, no-store" } })
      }
      const db = await checkDbHealth()
      const response = NextResponse.json(
        {
          ok: db.ok,
          db: {
            ok: db.ok,
            latencyMs: db.latencyMs,
            error: db.error,
            connectivity: db.connectivity,
            statementTimeout: db.statementTimeout,
            postgis: db.postgis,
            migration: db.migration,
            realtime: db.realtime,
          },
          version: APP_VERSION,
        },
      )
      response.headers.set("x-request-id", requestId)
      // Detailed diagnostics are per-admin and never cached.
      response.headers.set("Cache-Control", "private, no-store")
      return response
    }
    const db = await checkDbHealth()
    const response = NextResponse.json({
      ok: db.ok,
      version: APP_VERSION,
      latencyMs: Math.min(db.latencyMs, 500),
    })
    response.headers.set("x-request-id", requestId)
    // Basic probe — short CDN TTL absorbs monitor polling.
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30")
    return response
  })
}
