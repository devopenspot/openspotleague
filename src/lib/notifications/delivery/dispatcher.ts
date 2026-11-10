/**
 * Turns claimed outbox rows into SQS email jobs. Dependencies are injected
 * (store, sender, clock, URLs) so the logic is unit-tested without a DB or
 * AWS; `getDispatcher()` wires the real ones from env.
 *
 * Per claimed row:
 *   - no address / suppressed / category toggled off  → `skipped`
 *   - immediate → one job per row; digest → one job per user and category
 *   - enqueue failed → back to `pending` (the tick retries)
 * Job keys are stable for the same row set, so a re-enqueue is deduped by
 * SQS FIFO (5 min) and by the sender's DynamoDB idempotency (24 h).
 */

import { createHash } from "node:crypto"
import { emailPolicyFor } from "@/lib/notifications/definitions"
import type { NotificationEmailCategory } from "@/types/league"
import { EMAIL_JOB_VERSION, type EmailJob } from "./contract"
import type { QueueMessage, SqsSender } from "./sqs"
import type { ClaimedNotification, DeliveryStore, Recipient } from "./store"
import { renderDigestEmail, renderSingleEmail } from "./templates"
import { createUnsubscribeToken, unsubscribeUrl } from "./unsubscribe"

export const DISPATCH_LIMIT = 200
/** Immediate rows the after-commit push missed are retried after this. */
export const BACKSTOP_GRACE_MS = 2 * 60 * 1000
/** `queued` rows with no report are re-sent after this (idempotent). */
export const STALE_QUEUED_MS = 60 * 60 * 1000
/** Rows still unreported after this are marked `failed`. */
export const GIVE_UP_MS = 24 * 60 * 60 * 1000
/**
 * Pending rows older than this are `skipped`, never sent: an "event started"
 * email a day late is worse than none. Covers outages and switching email on.
 */
export const IMMEDIATE_MAX_AGE_MS = 6 * 60 * 60 * 1000
export const DIGEST_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface DispatcherDeps {
  store: DeliveryStore
  sender: SqsSender
  appUrl: string
  unsubscribeSecret: string
  now?: () => Date
}

export interface DispatchCounts {
  claimed: number
  queued: number
  skipped: number
  retry: number
}

const EMPTY: DispatchCounts = { claimed: 0, queued: 0, skipped: 0, retry: 0 }

function add(a: DispatchCounts, b: DispatchCounts): DispatchCounts {
  return {
    claimed: a.claimed + b.claimed,
    queued: a.queued + b.queued,
    skipped: a.skipped + b.skipped,
    retry: a.retry + b.retry,
  }
}

interface PendingJob {
  job: EmailJob
  groupId: string
}

function jobKey(prefix: string, ids: readonly string[]): string {
  const digest = createHash("sha256").update([...ids].sort().join(",")).digest("hex").slice(0, 40)
  return `${prefix}:${digest}`
}

function batchId(index: number): string {
  return `m${index}`
}

export function createDispatcher(deps: DispatcherDeps) {
  const now = deps.now ?? (() => new Date())

  function unsubscribeFor(userId: string, category: NotificationEmailCategory): string {
    return unsubscribeUrl(deps.appUrl, createUnsubscribeToken(deps.unsubscribeSecret, userId, category))
  }

  /** Splits claimed rows into jobs and skips. Pure given recipients. */
  function plan(
    rows: readonly ClaimedNotification[],
    recipients: ReadonlyMap<string, Recipient>,
  ): { jobs: PendingJob[]; skippedIds: string[] } {
    const jobs: PendingJob[] = []
    const skippedIds: string[] = []
    const digests = new Map<string, { recipient: Recipient; category: NotificationEmailCategory; rows: ClaimedNotification[] }>()

    for (const row of rows) {
      const policy = emailPolicyFor(row.type)
      const recipient = recipients.get(row.userId)
      const category = policy.category
      if (
        !policy.urgency ||
        !category ||
        !recipient?.email ||
        recipient.suppressed ||
        !recipient.categories[category]
      ) {
        skippedIds.push(row.id)
        continue
      }
      if ((row.urgency ?? policy.urgency) === "immediate") {
        const unsubscribe = unsubscribeFor(row.userId, category)
        jobs.push({
          groupId: row.userId,
          job: {
            v: EMAIL_JOB_VERSION,
            channel: "email",
            key: jobKey("n", [row.id]),
            notificationIds: [row.id],
            to: recipient.email,
            category,
            unsubscribeUrl: unsubscribe,
            ...renderSingleEmail({
              appUrl: deps.appUrl,
              notification: row,
              category,
              unsubscribeUrl: unsubscribe,
            }),
          },
        })
        continue
      }
      const groupKey = `${row.userId}:${category}`
      const group = digests.get(groupKey) ?? { recipient, category, rows: [] }
      group.rows.push(row)
      digests.set(groupKey, group)
    }

    for (const group of digests.values()) {
      const ordered = [...group.rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      const ids = ordered.map((row) => row.id)
      const unsubscribe = unsubscribeFor(group.recipient.userId, group.category)
      jobs.push({
        groupId: group.recipient.userId,
        job: {
          v: EMAIL_JOB_VERSION,
          channel: "email",
          key: jobKey("d", ids),
          notificationIds: ids,
          to: group.recipient.email!,
          category: group.category,
          unsubscribeUrl: unsubscribe,
          ...renderDigestEmail({
            appUrl: deps.appUrl,
            notifications: ordered,
            category: group.category,
            unsubscribeUrl: unsubscribe,
          }),
        },
      })
    }
    return { jobs, skippedIds }
  }

  async function deliver(rows: readonly ClaimedNotification[]): Promise<DispatchCounts> {
    if (rows.length === 0) return EMPTY
    let planned: ReturnType<typeof plan>
    try {
      const recipients = await deps.store.loadRecipients(rows.map((row) => row.userId))
      planned = plan(rows, recipients)
      await deps.store.setStatus(planned.skippedIds, "skipped")
    } catch (error) {
      // Nothing reached SQS yet: release the claim so the next tick retries,
      // instead of leaving the rows `queued` for an hour.
      await deps.store.setStatus(rows.map((row) => row.id), "pending").catch(() => undefined)
      throw error
    }
    const { jobs, skippedIds } = planned

    const messages: QueueMessage[] = jobs.map((pending, index) => ({
      id: batchId(index),
      groupId: pending.groupId,
      job: pending.job,
    }))
    const result = await deps.sender.send(messages)
    const failed = new Set(result.failed.map((entry) => entry.id))
    // Anything not confirmed goes back to pending for the next tick.
    const retryIds = messages
      .filter((message) => failed.has(message.id) || !result.succeeded.includes(message.id))
      .flatMap((message) => message.job.notificationIds)
    await deps.store.setStatus(retryIds, "pending")
    return {
      claimed: rows.length,
      queued: rows.length - skippedIds.length - retryIds.length,
      skipped: skippedIds.length,
      retry: retryIds.length,
    }
  }

  /** Drops pending rows past their max age before anything is claimed. */
  function expireOld(): Promise<number> {
    const at = now().getTime()
    return deps.store.expirePending({
      immediateBefore: new Date(at - IMMEDIATE_MAX_AGE_MS),
      digestBefore: new Date(at - DIGEST_MAX_AGE_MS),
    })
  }

  return {
    plan,

    /** After-commit push for rows a write just created. */
    async dispatchImmediate(ids: readonly string[]): Promise<DispatchCounts> {
      const rows = await deps.store.claimPending({ ids, urgency: "immediate", limit: DISPATCH_LIMIT })
      return deliver(rows)
    },

    /** Tick: every pending digest row, grouped per user and category. */
    async dispatchDigests(): Promise<DispatchCounts> {
      await expireOld()
      const rows = await deps.store.claimPending({ urgency: "digest", createdBefore: now(), limit: DISPATCH_LIMIT })
      return deliver(rows)
    },

    /** Tick: immediate rows the push missed, and queued rows never reported. */
    async runBackstop(): Promise<DispatchCounts & { expired: number }> {
      const at = now().getTime()
      const tooOld = await expireOld()
      const missed = await deps.store.claimPending({
        urgency: "immediate",
        createdBefore: new Date(at - BACKSTOP_GRACE_MS),
        limit: DISPATCH_LIMIT,
      })
      const stale = await deps.store.claimStaleQueued({
        queuedBefore: new Date(at - STALE_QUEUED_MS),
        notBefore: new Date(at - GIVE_UP_MS),
        limit: DISPATCH_LIMIT,
      })
      const gaveUp = await deps.store.expireStale({ createdBefore: new Date(at - GIVE_UP_MS) })
      const counts = add(await deliver(missed), await deliver(stale))
      return { ...counts, expired: tooOld + gaveUp }
    },
  }
}

export type Dispatcher = ReturnType<typeof createDispatcher>
