/**
 * Resend webhook verification and mapping, for the events Lambda
 * (`infra/aws/lambdas/resend-events.ts`). Imported by relative path, like
 * `contract.ts`: no `@/` aliases.
 *
 * Resend signs webhooks the Svix way: `svix-signature` holds one or more
 * space-separated `v1,<base64>` entries, each an HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` keyed with the base64 part of the
 * `whsec_…` secret. The timestamp is in seconds; five minutes either side.
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import type { DeliveryReport } from "./contract"

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

export type WebhookCheck = "ok" | "missing" | "expired" | "invalid"

export function verifyResendWebhook(input: {
  secret: string
  body: string
  id: string | null | undefined
  timestamp: string | null | undefined
  signature: string | null | undefined
  now?: Date
}): WebhookCheck {
  if (!input.id || !input.timestamp || !input.signature) return "missing"
  const sentAt = Number(input.timestamp)
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000)
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > WEBHOOK_TOLERANCE_SECONDS) return "expired"
  const key = Buffer.from(input.secret.replace(/^whsec_/, ""), "base64")
  const expected = createHmac("sha256", key)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest()
  for (const entry of input.signature.split(" ")) {
    const [version, value] = entry.split(",", 2)
    if (version !== "v1" || !value) continue
    const given = Buffer.from(value, "base64")
    if (given.length === expected.length && timingSafeEqual(given, expected)) return "ok"
  }
  return "invalid"
}

interface ResendEvent {
  type?: unknown
  data?: { to?: unknown; bounce?: { type?: unknown } }
}

/**
 * Permanent bounces and complaints suppress the address in the app. Temporary
 * bounces and every other event type are ignored (Resend already retried, and
 * it keeps its own suppression list as well).
 */
export function resendEventToReports(event: ResendEvent): DeliveryReport["reports"] {
  const recipients = Array.isArray(event.data?.to)
    ? event.data.to.filter((email): email is string => typeof email === "string" && email.includes("@"))
    : []
  if (event.type === "email.bounced" && event.data?.bounce?.type === "Permanent") {
    return recipients.map((email) => ({ kind: "feedback" as const, email, status: "bounced" as const }))
  }
  if (event.type === "email.complained") {
    return recipients.map((email) => ({ kind: "feedback" as const, email, status: "complained" as const }))
  }
  return []
}
