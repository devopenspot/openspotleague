import "server-only"

import { NextResponse, type NextRequest } from "next/server"
import { getNotificationsInternalSecret } from "@/lib/config/env"
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/notifications/delivery/contract"

const MAX_BODY_BYTES = 256 * 1024

/**
 * Reads and verifies a request signed by the AWS notification Lambdas.
 * Returns the raw body on success, or the response to send back.
 */
export async function readSignedBody(
  request: NextRequest,
): Promise<{ body: string } | { response: NextResponse }> {
  const secret = getNotificationsInternalSecret()
  if (!secret) {
    return { response: NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 }) }
  }
  const timestamp = request.headers.get(TIMESTAMP_HEADER)
  const signature = request.headers.get(SIGNATURE_HEADER)
  // Unsigned traffic is turned away before its body is read.
  if (!timestamp || !signature) {
    return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) }
  }
  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ error: "TOO_LARGE" }, { status: 413 }) }
  }
  const check = verifySignature({
    secret,
    path: request.nextUrl.pathname,
    body,
    timestamp,
    signature,
  })
  if (check !== "ok") {
    return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) }
  }
  return { body }
}
