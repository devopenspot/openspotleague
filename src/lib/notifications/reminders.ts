/**
 * Time-based League reminders — pure selection run by the 15-minute tick.
 * Inputs are plain rows the store loaded; output is notification drafts with
 * a `dedupeKey` so a tick that runs twice (or overlaps) never notifies
 * twice: the unique index on `user_notifications.dedupe_key` drops repeats.
 *
 * Nothing in the app moves contests on a clock (deadlines are evaluated on
 * read/write), so these are the only notifications that originate from time.
 */

import { paymentGate } from "@/lib/league/engine"
import type { NotificationPayload, NotificationType } from "@/types/league"

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

/** Warn this far ahead of a deadline. */
export const REMINDER_LEAD_MS = DAY_MS
/** A submitted video must wait this long unscored before judges are nudged. */
export const JUDGING_STALE_MS = DAY_MS

export interface ReminderDraft {
  userId: string
  type: NotificationType
  payload: NotificationPayload
  eventId: string
  dedupeKey: string
}

export interface ReminderEvent {
  id: string
  slug: string
  name: string
}

function eventPayload(event: ReminderEvent): NotificationPayload {
  return { eventId: event.id, eventSlug: event.slug, eventName: event.name }
}

// ---------- video deadline ----------

export interface VideoDeadlineCandidate extends ReminderEvent {
  /** IANA zone of the contest, so the email shows local time. */
  timeZone?: string | null
  deadline: Date
  /** Riders with at least one run still `scheduled` (no video yet). */
  riderIdsMissingVideo: readonly string[]
}

/** Live video contests whose deadline is within the lead window. */
export function selectVideoDeadlineReminders(
  candidates: readonly VideoDeadlineCandidate[],
  now: Date,
): ReminderDraft[] {
  const drafts: ReminderDraft[] = []
  for (const event of candidates) {
    const remaining = event.deadline.getTime() - now.getTime()
    if (remaining <= 0 || remaining > REMINDER_LEAD_MS) continue
    for (const userId of new Set(event.riderIdsMissingVideo)) {
      drafts.push({
        userId,
        type: "league_video_deadline_reminder",
        payload: {
          ...eventPayload(event),
          dueAt: event.deadline.toISOString(),
          ...(event.timeZone ? { timeZone: event.timeZone } : {}),
        },
        eventId: event.id,
        // The deadline is part of the key: moving it reminds again.
        dedupeKey: `vdl24:${event.id}:${userId}:${event.deadline.getTime()}`,
      })
    }
  }
  return drafts
}

// ---------- judging backlog ----------

export interface JudgingCandidate extends ReminderEvent {
  judgeIds: readonly string[]
  /** Submitted runs: when the video arrived and which judges scored it. */
  submittedRuns: readonly { submittedAt: Date; scoredBy: readonly string[] }[]
}

/** Whole days a judge's oldest waiting video has been in: remind on these, then stop. */
export const JUDGING_REMINDER_DAYS: readonly number[] = [1, 3, 7]

/**
 * Judges with submitted runs unscored for over a day. Each judge is reminded
 * on day 1, 3 and 7 of their oldest waiting video, then left alone; scoring
 * it restarts the count from the next oldest. The key carries that video's
 * time and the day, so a day is never sent twice.
 */
export function selectJudgingReminders(
  candidates: readonly JudgingCandidate[],
  now: Date,
): ReminderDraft[] {
  const drafts: ReminderDraft[] = []
  for (const event of candidates) {
    const stale = event.submittedRuns.filter(
      (run) => now.getTime() - run.submittedAt.getTime() >= JUDGING_STALE_MS,
    )
    if (stale.length === 0) continue
    for (const judgeId of new Set(event.judgeIds)) {
      const waiting = stale.filter((run) => !run.scoredBy.includes(judgeId))
      if (waiting.length === 0) continue
      const oldest = Math.min(...waiting.map((run) => run.submittedAt.getTime()))
      const day = Math.floor((now.getTime() - oldest) / DAY_MS)
      if (!JUDGING_REMINDER_DAYS.includes(day)) continue
      drafts.push({
        userId: judgeId,
        type: "league_judging_reminder",
        payload: { ...eventPayload(event), pendingCount: waiting.length },
        eventId: event.id,
        dedupeKey: `jdg:${event.id}:${judgeId}:${oldest}:${day}`,
      })
    }
  }
  return drafts
}

// ---------- payment gate ----------

export interface PaymentGateCandidate extends ReminderEvent {
  createdAt: Date
  hasActivePayment: boolean
  /** Main organizer (falls back to the creator). */
  ownerId: string | null
}

/**
 * The day before the gate locks (day 2) and before it disables (day 5),
 * derived from the same `paymentGate` the write path enforces.
 */
export function selectPaymentGateReminders(
  candidates: readonly PaymentGateCandidate[],
  now: Date,
): ReminderDraft[] {
  const drafts: ReminderDraft[] = []
  for (const event of candidates) {
    if (!event.ownerId) continue
    const gate = paymentGate({
      createdAt: event.createdAt,
      hasActivePayment: event.hasActivePayment,
      now,
    })
    let step: "lock" | "disable" | null = null
    let at: Date | null = null
    if (gate.state === "pending") {
      step = "lock"
      at = gate.paymentDueAt
    } else if (gate.state === "locked") {
      step = "disable"
      at = gate.paymentDeadlineAt
    }
    if (!step || !at) continue
    const remaining = at.getTime() - now.getTime()
    if (remaining <= 0 || remaining > REMINDER_LEAD_MS) continue
    drafts.push({
      userId: event.ownerId,
      type: "league_payment_gate_reminder",
      payload: { ...eventPayload(event), gateStep: step, dueAt: at.toISOString() },
      eventId: event.id,
      dedupeKey: `pay:${event.id}:${step}`,
    })
  }
  return drafts
}
