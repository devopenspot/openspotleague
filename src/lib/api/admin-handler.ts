import "server-only"

import { NextResponse } from "next/server"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import {
  isInvalidConcurrencyTokenError,
  isInvalidReferenceError,
  isStaleRecordError,
} from "@/lib/repositories/core/errors"
import { UploadValidationError } from "@/lib/storage/errors"

/**
 * Shared error → response mapping for admin content mutation routes.
 *
 * The contract:
 * - typed domain errors keep their message (400/409)
 * - "…not found" messages map to 404 with their message
 * - validation-class upload failures map to 400 with their message
 * - DB timeout/connection errors map to 503 with a generic service message
 * - everything else maps to 500 "Internal error" (message logged, not echoed)
 *
 * `notFoundPrefixes` are message prefixes produced by the underlying service
 * for missing entities (typed NotFoundError does not exist yet — repositories
 * still throw plain `Error("Spot not found: …")`).
 */
export function mapMutationErrorResponse(
  error: unknown,
  opts: {
    serviceName: string
    notFoundPrefixes: readonly string[]
    logLabel: string
    log: (label: string, message: string) => void
  },
): NextResponse {
  const message =
    error instanceof Error ? error.message : "Internal error"
  if (isInvalidConcurrencyTokenError(error)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (isStaleRecordError(error)) {
    return NextResponse.json({ error: message }, { status: 409 })
  }
  if (isInvalidReferenceError(error)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (error instanceof UploadValidationError) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (error instanceof TimeoutError || isConnectionError(error)) {
    return NextResponse.json(
      { error: `The ${opts.serviceName} service is temporarily unavailable` },
      { status: 503 },
    )
  }
  if (opts.notFoundPrefixes.some((prefix) => message.startsWith(prefix))) {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  opts.log(opts.logLabel, message)
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}

/** Standard 400 body for a failed `safeParse` on a mutation payload. */
export function zodValidationResponse(
  errorLabel: string,
  error: { flatten: () => unknown },
): NextResponse {
  return NextResponse.json(
    { error: errorLabel, details: error.flatten() },
    { status: 400 },
  )
}

/** Shared `Invalid JSON body` 400 for POST/PATCH handlers. */
export function invalidJsonResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
}
