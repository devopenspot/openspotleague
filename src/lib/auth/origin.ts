import { env } from "@/lib/config/env"
import { log } from "@/lib/utils/log"

function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    const allow = new Set<string>([env.APP_URL, "http://localhost:3000", "http://127.0.0.1:3000"])
    if (allow.has(u.origin)) return true
    if (process.env.NODE_ENV === "development" && u.hostname === "localhost") return true
    return false
  } catch {
    return false
  }
}

export function originFromRequest(request: Request): string {
  const fallback = new URL(request.url).origin
  const candidates = [
    request.headers.get("origin"),
    request.headers.get("x-forwarded-origin"),
    request.headers.get("x-forwarded-host") ? `https://${request.headers.get("x-forwarded-host")}` : null,
  ].filter(Boolean) as string[]

  for (const cand of candidates) {
    try {
      const u = new URL(cand)
      if (isAllowedOrigin(u.origin)) return u.origin
    } catch {
      // ignore malformed
    }
  }
  if (candidates.length) log.warn("origin trust rejected", { candidates, fallback })
  return fallback
}
