/**
 * Resend HTTP API, request side and outcome rules, for the sender Lambda
 * (`infra/aws/lambdas/email-sender.ts`). Imported by relative path, like
 * `contract.ts`: no `@/` aliases, no app config.
 *
 * Resend's free plan (3,000 emails a month, 100 a day, no card) refuses
 * mail over quota with a 429 instead of billing it. That 429 becomes a
 * `quota` outcome: the job is handed back to the Worker, not retried.
 */

import type { EmailJob } from "./contract"

export const RESEND_EMAILS_URL = "https://api.resend.com/emails"

export interface ResendSenderOptions {
  apiKey: string
  /** `OpenSpot League <no-reply@mail.openspotleague.com>` */
  from: string
  replyTo?: string
}

export function buildResendRequest(job: EmailJob, options: ResendSenderOptions): RequestInit {
  return {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      // Resend replays the stored response for 24 h, like the DynamoDB layer.
      "idempotency-key": job.key,
    },
    body: JSON.stringify({
      from: options.from,
      to: [job.to],
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      subject: job.subject,
      html: job.html,
      text: job.text,
      headers: {
        "List-Unsubscribe": `<${job.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "category", value: job.category }],
    }),
  }
}

export type ResendOutcome =
  | { kind: "sent"; id: string }
  /** This one email can never be sent (bad address, invalid content). */
  | { kind: "permanent"; reason: string }
  /** The free quota is used up: stop sending until the next UTC day. */
  | { kind: "quota"; reason: string }
  /** Try again later (rate limit, outage, account-wide problem). */
  | { kind: "retry"; reason: string }

const QUOTA_ERRORS = new Set(["daily_quota_exceeded", "monthly_quota_exceeded"])

function errorName(body: unknown): string {
  if (body && typeof body === "object" && "name" in body && typeof body.name === "string") {
    return body.name.slice(0, 100)
  }
  return "unknown_error"
}

/**
 * Only the status and Resend's error name are kept: the message can contain
 * the recipient address.
 */
export function classifyResendResponse(status: number, body: unknown): ResendOutcome {
  if (status >= 200 && status < 300) {
    const id =
      body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : ""
    return { kind: "sent", id }
  }
  const name = errorName(body)
  if (status === 429) {
    return QUOTA_ERRORS.has(name) ? { kind: "quota", reason: name } : { kind: "retry", reason: name }
  }
  // 400/422: this email's own fields are invalid. 401/403 are account-wide
  // (bad key, unverified domain) and must reach the DLQ alarm, so they retry.
  if (status === 400 || status === 422) return { kind: "permanent", reason: name }
  return { kind: "retry", reason: `${status} ${name}` }
}
