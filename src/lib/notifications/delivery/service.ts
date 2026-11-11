/**
 * Orchestration behind the internal notification routes:
 * - `runNotificationTick`: the 15-minute EventBridge tick — reminders first
 *   (so their immediate emails ride the same run), then the backstop and the
 *   daily digests.
 * - `applyDeliveryReports`: outcomes from the sender and Resend bounce /
 *   complaint feedback.
 * - `unsubscribeByToken`: the one-click unsubscribe target.
 */

import "server-only"

import { getDbClient, withDbWrite } from "@/lib/db/client"
import { getEmailCaps, getNotificationsUnsubscribeSecret } from "@/lib/config/env"
import { createNotifications, setEmailPreferences } from "@/lib/notifications/service"
import {
  JUDGING_STALE_MS,
  REMINDER_LEAD_MS,
  selectJudgingReminders,
  selectPaymentGateReminders,
  selectVideoDeadlineReminders,
  type ReminderDraft,
} from "@/lib/notifications/reminders"
import { PAYMENT_DISABLE_AFTER_DAYS } from "@/lib/league/definitions"
import type { NotificationEmailCategory } from "@/types/league"
import type { DeliveryReport } from "./contract"
import type { DispatchCounts } from "./dispatcher"
import { getDispatcher } from "./index"
import { deliveryStore } from "./store"
import { readUnsubscribeToken } from "./unsubscribe"

const DAY_MS = 24 * 60 * 60 * 1000

export interface TickResult {
  reminders: number
  backstop: (DispatchCounts & { expired: number }) | null
  digests: DispatchCounts | null
}

async function insertReminders(drafts: readonly ReminderDraft[]): Promise<number> {
  if (drafts.length === 0) return 0
  const { db } = getDbClient()
  // Immediate reminders are queued after this write commits (same hook as
  // every other notification); duplicates are dropped by `dedupe_key`.
  return withDbWrite("notifications.reminders.insert", () =>
    db.transaction(async (tx) => (await createNotifications(tx, drafts)).length),
  )
}

export async function runNotificationTick(now: Date = new Date()): Promise<TickResult> {
  const [videoCandidates, judgingCandidates, paymentCandidates] = await Promise.all([
    deliveryStore.videoDeadlineCandidates(now, new Date(now.getTime() + REMINDER_LEAD_MS)),
    deliveryStore.judgingCandidates(new Date(now.getTime() - JUDGING_STALE_MS)),
    deliveryStore.paymentGateCandidates(new Date(now.getTime() - PAYMENT_DISABLE_AFTER_DAYS * DAY_MS)),
  ])
  const reminders = await insertReminders([
    ...selectVideoDeadlineReminders(videoCandidates, now),
    ...selectJudgingReminders(judgingCandidates, now),
    ...selectPaymentGateReminders(paymentCandidates, now),
  ])

  const dispatcher = getDispatcher()
  if (!dispatcher) return { reminders, backstop: null, digests: null }
  const backstop = await dispatcher.runBackstop()
  const digests = await dispatcher.dispatchDigests()
  return { reminders, backstop, digests }
}

export async function applyDeliveryReports(
  report: DeliveryReport,
  now: Date = new Date(),
): Promise<{ applied: number }> {
  let applied = 0
  let quotaClosed = false
  for (const entry of report.reports) {
    if (entry.kind === "job") {
      if (entry.status === "deferred") {
        // The provider's free quota is gone: hand the rows back and stop
        // queueing more until the next UTC day.
        await deliveryStore.setStatus(entry.notificationIds, "pending")
        if (!quotaClosed) {
          await deliveryStore.exhaustEmailBudget({ dailyCap: getEmailCaps().daily, now })
          quotaClosed = true
        }
      } else {
        await deliveryStore.setStatus(entry.notificationIds, entry.status)
      }
      applied += entry.notificationIds.length
      continue
    }
    applied += await deliveryStore.suppressAddress(
      entry.email,
      entry.status === "complained" ? "complaint" : "bounce",
    )
  }
  return { applied }
}

/** The category a link unsubscribes from, or null for a link that is not ours. Changes nothing. */
export function readUnsubscribeCategory(token: string | null): NotificationEmailCategory | null {
  const secret = getNotificationsUnsubscribeSecret()
  if (!secret) return null
  return readUnsubscribeToken(secret, token)?.category ?? null
}

export async function unsubscribeByToken(
  token: string | null,
): Promise<{ category: NotificationEmailCategory } | null> {
  const secret = getNotificationsUnsubscribeSecret()
  if (!secret) return null
  const parsed = readUnsubscribeToken(secret, token)
  if (!parsed) return null
  await setEmailPreferences(parsed.userId, { [parsed.category]: false })
  return { category: parsed.category }
}
