/**
 * Wire contract between the Worker and the AWS notification Lambdas
 * (infra/aws). Imported by both sides by relative path, so it must stay
 * self-contained: zod and node:crypto only, no `@/` aliases, no app config.
 *
 * - `EmailJob`: one SQS message = one email (single or digest).
 * - `DeliveryReport`: Lambdas → `POST /api/internal/notifications/delivery`
 *   (send outcomes, and Resend bounce / complaint feedback).
 * - Signed requests: `x-osl-timestamp` + `x-osl-signature`, an HMAC-SHA256
 *   over `${timestamp}.${path}.${body}` with NOTIFICATIONS_INTERNAL_SECRET,
 *   valid for five minutes either side. The path is signed so a captured
 *   request cannot be replayed against the other internal route.
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

export const EMAIL_JOB_VERSION = 1

export const EmailCategorySchema = z.enum(["contest_updates", "reminders", "judging", "results"])

export const EmailJobSchema = z.object({
  v: z.literal(EMAIL_JOB_VERSION),
  /** Room for `webpush` later without a new queue contract. */
  channel: z.literal("email"),
  /** Idempotency key: stable for the same notification set. */
  key: z.string().min(1).max(128),
  notificationIds: z.array(z.string().uuid()).min(1).max(200),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(200_000),
  text: z.string().min(1).max(100_000),
  category: EmailCategorySchema,
  /** RFC 8058 one-click target (List-Unsubscribe / List-Unsubscribe-Post). */
  unsubscribeUrl: z.string().url(),
})
export type EmailJob = z.infer<typeof EmailJobSchema>

export const DeliveryReportSchema = z.object({
  reports: z
    .array(
      z.union([
        // From the sender: outcome for the rows an EmailJob carried.
        // `deferred`: the email provider's free quota is used up; the rows
        // go back to `pending` and today's budget is closed.
        z.object({
          kind: z.literal("job"),
          notificationIds: z.array(z.string().uuid()).min(1).max(200),
          status: z.enum(["sent", "failed", "deferred"]),
          messageId: z.string().max(200).optional(),
          reason: z.string().max(500).optional(),
        }),
        // From provider feedback: a recipient address that must stop receiving.
        z.object({
          kind: z.literal("feedback"),
          email: z.string().email(),
          status: z.enum(["bounced", "complained"]),
        }),
      ]),
    )
    .min(1)
    .max(100),
})
export type DeliveryReport = z.infer<typeof DeliveryReportSchema>

// ---------- signing ----------

export const SIGNATURE_HEADER = "x-osl-signature"
export const TIMESTAMP_HEADER = "x-osl-timestamp"
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000

/** `path` is the URL pathname the request is sent to, e.g. `/api/internal/notifications/tick`. */
export function signBody(secret: string, timestamp: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${path}.${body}`).digest("hex")
}

/** Headers for a signed internal request to `path`. */
export function signedHeaders(
  secret: string,
  path: string,
  body: string,
  now: Date = new Date(),
): Record<string, string> {
  const timestamp = String(now.getTime())
  return {
    "content-type": "application/json",
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: signBody(secret, timestamp, path, body),
  }
}

export type SignatureCheck = "ok" | "missing" | "expired" | "invalid"

export function verifySignature(input: {
  secret: string
  path: string
  body: string
  timestamp: string | null
  signature: string | null
  now?: Date
}): SignatureCheck {
  if (!input.timestamp || !input.signature) return "missing"
  const sentAt = Number(input.timestamp)
  const now = (input.now ?? new Date()).getTime()
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > SIGNATURE_TOLERANCE_MS) {
    return "expired"
  }
  const expected = signBody(input.secret, input.timestamp, input.path, input.body)
  const given = input.signature.trim().toLowerCase()
  if (given.length !== expected.length) return "invalid"
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ? "ok" : "invalid"
}
