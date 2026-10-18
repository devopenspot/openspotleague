import { NextResponse } from "next/server"
import type { ZodError } from "zod"

/**
 * Shared response/guard building blocks for `/api/league/**` routes. Every
 * mutation route is a thin clone of the same envelope (auth → rate limit →
 * parse → validate → service → mapped errors); these helpers keep the
 * clones byte-identical so a fix lands everywhere at once.
 */

/** Canonical 401 — every league mutation/private read gates on a session. */
export function leagueUnauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 },
  )
}

/** Canonical 400 for malformed JSON payloads. */
export function leagueInvalidJson(): NextResponse {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
}

/** Canonical 400 for zod failures (flattened details echoed back). */
export function leagueInvalidBody(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: "Invalid body", details: error.flatten() },
    { status: 400 },
  )
}

/** Private reads are never cached by intermediaries (spec line 19). */
export function privateNoCache(): { "Cache-Control": string } {
  return { "Cache-Control": "private, no-cache" }
}

/**
 * Version short-circuit (games parity): honors `?version=N` and the
 * `"event-<id>-"` ETag prefix via `If-None-Match`. Returns `invalid: true`
 * for non-integer requests (caller → 400) and omits `knownVersion` when the
 * client did not ask for a short-circuit.
 */
export function leagueRequestedVersion(
  request: { nextUrl: URL; headers: { get(name: string): string | null } },
  etagPrefix: string,
): { knownVersion?: number; invalid: boolean } {
  const knownVersionValue = request.nextUrl.searchParams.get("version")
  const ifNoneMatch = request.headers.get("if-none-match")
  const etagVersion =
    ifNoneMatch?.startsWith(etagPrefix) && ifNoneMatch.endsWith('"')
      ? ifNoneMatch.slice(etagPrefix.length, -1)
      : undefined
  const requestedVersion = knownVersionValue ?? etagVersion ?? null
  if (requestedVersion === null) return { invalid: false }
  const knownVersion = Number(requestedVersion)
  if (!Number.isInteger(knownVersion)) return { invalid: true }
  return { knownVersion, invalid: false }
}

/** Canonical 304 echoing the current ETag. */
export function leagueNotModified(
  id: string,
  version: number,
): NextResponse {
  return new NextResponse(null, {
    status: 304,
    headers: { ETag: `"event-${id}-${version}"` },
  })
}
