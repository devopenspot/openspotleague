/**
 * Email budget rules for the free email plan (Resend Free: 100 a day and
 * 3,000 a month, no card; over quota it refuses instead of billing). Pure, so
 * the store applies them inside its row lock and tests cover them directly.
 *
 * Immediate mail (event started, results, reminders) may use the whole cap.
 * Digests stop at `digestShare` of either cap, so the rest stays free for
 * immediate mail later the same day or month.
 */

export interface EmailCaps {
  daily: number
  monthly: number
  /** Fraction of each cap digests may fill, 0–1. */
  digestShare: number
}

export interface EmailRequest {
  immediate: number
  digest: number
}

export const DEFAULT_EMAIL_CAPS: EmailCaps = { daily: 95, monthly: 2900, digestShare: 0.6 }

/** UTC calendar day `YYYY-MM-DD` (Resend's daily quota resets at 00:00 UTC). */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/** First day of `at`'s UTC month, `YYYY-MM-01`. */
export function utcMonthStart(at: Date): string {
  return `${at.toISOString().slice(0, 7)}-01`
}

/**
 * How many of each kind fit, given what today and this month already used
 * (`usedMonth` includes today).
 */
export function allowEmails(
  used: { today: number; month: number },
  caps: EmailCaps,
  request: EmailRequest,
): EmailRequest {
  const room = Math.max(0, Math.min(caps.daily - used.today, caps.monthly - used.month))
  const immediate = Math.min(Math.max(0, request.immediate), room)
  const digestDaily = Math.floor(caps.daily * caps.digestShare) - used.today - immediate
  const digestMonthly = Math.floor(caps.monthly * caps.digestShare) - used.month - immediate
  const digest = Math.max(
    0,
    Math.min(Math.max(0, request.digest), room - immediate, digestDaily, digestMonthly),
  )
  return { immediate, digest }
}
