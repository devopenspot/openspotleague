/**
 * Database side of email delivery: the `user_notifications` outbox, recipient
 * preferences, SES feedback, and the reminder candidate reads. Same layer as
 * `src/lib/notifications/service.ts` (the notification single writer).
 *
 * Claiming is an atomic `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP
 * LOCKED) RETURNING`: a row moves `pending → queued` before the SQS call, so
 * overlapping ticks never enqueue the same row twice and no transaction is
 * held open across the network. Rows whose enqueue fails go back to
 * `pending`; rows lost after the claim are retried from `queued` after an
 * hour (the sender's DynamoDB idempotency makes that resend-safe).
 */

import "server-only"

import { and, eq, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm"
import { getDbClient, withDbRead, withDbWrite } from "@/lib/db/client"
import {
  eventMemberships,
  eventPayments,
  eventRuns,
  eventScores,
  profiles,
  sportEvents,
  userEmailPreferences,
  userNotifications,
} from "@/db/schema"
import type {
  NotificationEmailCategory,
  NotificationEmailStatus,
  NotificationEmailUrgency,
  NotificationPayload,
  NotificationType,
} from "@/types/league"
import type {
  JudgingCandidate,
  PaymentGateCandidate,
  VideoDeadlineCandidate,
} from "@/lib/notifications/reminders"

export interface ClaimedNotification {
  id: string
  userId: string
  type: NotificationType
  payload: NotificationPayload
  urgency: NotificationEmailUrgency | null
  createdAt: Date
}

export interface Recipient {
  userId: string
  email: string | null
  suppressed: boolean
  categories: Record<NotificationEmailCategory, boolean>
}

export interface ClaimFilter {
  ids?: readonly string[]
  urgency?: NotificationEmailUrgency
  createdBefore?: Date
  limit: number
}

const RETURNING = {
  id: userNotifications.id,
  userId: userNotifications.userId,
  type: userNotifications.type,
  payload: userNotifications.payload,
  urgency: userNotifications.emailUrgency,
  createdAt: userNotifications.createdAt,
}

function claim(
  label: string,
  from: NotificationEmailStatus,
  conditions: SQL[],
  limit: number,
): Promise<ClaimedNotification[]> {
  const { db } = getDbClient()
  return withDbWrite(label, () =>
    db.transaction(async (tx) => {
      const candidates = tx
        .select({ id: userNotifications.id })
        .from(userNotifications)
        .where(and(eq(userNotifications.emailStatus, from), ...conditions))
        .orderBy(userNotifications.createdAt)
        .limit(limit)
        .for("update", { skipLocked: true })
      return tx
        .update(userNotifications)
        .set({ emailStatus: "queued", emailQueuedAt: new Date() })
        .where(inArray(userNotifications.id, candidates))
        .returning(RETURNING)
    }),
  )
}

export const deliveryStore = {
  /** `pending → queued` for the rows matching the filter. */
  claimPending(filter: ClaimFilter): Promise<ClaimedNotification[]> {
    const conditions: SQL[] = []
    if (filter.ids) {
      if (filter.ids.length === 0) return Promise.resolve([])
      conditions.push(inArray(userNotifications.id, [...filter.ids]))
    }
    if (filter.urgency) conditions.push(eq(userNotifications.emailUrgency, filter.urgency))
    if (filter.createdBefore) conditions.push(lt(userNotifications.createdAt, filter.createdBefore))
    return claim("notifications.claimPending", "pending", conditions, filter.limit)
  },

  /** Re-claims rows stuck in `queued` (enqueued but never reported). */
  claimStaleQueued(input: { queuedBefore: Date; notBefore: Date; limit: number }): Promise<ClaimedNotification[]> {
    return claim(
      "notifications.claimStale",
      "queued",
      [
        lt(userNotifications.emailQueuedAt, input.queuedBefore),
        sql`${userNotifications.createdAt} >= ${input.notBefore}`,
      ],
      input.limit,
    )
  },

  /**
   * Pending rows too old to be worth sending (email was off, or an outage
   * outlasted them) become `skipped`, so a recovery never sends stale mail.
   */
  async expirePending(input: { immediateBefore: Date; digestBefore: Date }): Promise<number> {
    const { db } = getDbClient()
    return withDbWrite("notifications.expirePending", async () => {
      const rows = await db
        .update(userNotifications)
        .set({ emailStatus: "skipped" })
        .where(
          and(
            eq(userNotifications.emailStatus, "pending"),
            or(
              and(
                eq(userNotifications.emailUrgency, "immediate"),
                lt(userNotifications.createdAt, input.immediateBefore),
              ),
              and(
                eq(userNotifications.emailUrgency, "digest"),
                lt(userNotifications.createdAt, input.digestBefore),
              ),
            ),
          ),
        )
        .returning({ id: userNotifications.id })
      return rows.length
    })
  },

  /** Rows queued for over a day with no report: give up. */
  async expireStale(input: { createdBefore: Date }): Promise<number> {
    const { db } = getDbClient()
    return withDbWrite("notifications.expireStale", async () => {
      const rows = await db
        .update(userNotifications)
        .set({ emailStatus: "failed" })
        .where(
          and(
            eq(userNotifications.emailStatus, "queued"),
            lt(userNotifications.createdAt, input.createdBefore),
          ),
        )
        .returning({ id: userNotifications.id })
      return rows.length
    })
  },

  async setStatus(ids: readonly string[], status: NotificationEmailStatus): Promise<void> {
    if (ids.length === 0) return
    const { db } = getDbClient()
    const now = new Date()
    await withDbWrite("notifications.setEmailStatus", () =>
      db
        .update(userNotifications)
        .set({
          emailStatus: status,
          ...(status === "pending" ? { emailQueuedAt: null } : {}),
          ...(status === "sent" ? { emailedAt: now } : {}),
        })
        .where(inArray(userNotifications.id, [...ids])),
    )
  },

  async loadRecipients(userIds: readonly string[]): Promise<Map<string, Recipient>> {
    const result = new Map<string, Recipient>()
    if (userIds.length === 0) return result
    const { db } = getDbClient()
    const rows = await withDbRead("notifications.loadRecipients", () =>
      db
        .select({
          userId: profiles.id,
          email: profiles.email,
          contestUpdates: userEmailPreferences.contestUpdates,
          reminders: userEmailPreferences.reminders,
          judging: userEmailPreferences.judging,
          results: userEmailPreferences.results,
          suppressedAt: userEmailPreferences.suppressedAt,
        })
        .from(profiles)
        .leftJoin(userEmailPreferences, eq(userEmailPreferences.userId, profiles.id))
        .where(inArray(profiles.id, [...new Set(userIds)])),
    )
    for (const row of rows) {
      result.set(row.userId, {
        userId: row.userId,
        email: row.email?.trim() || null,
        suppressed: row.suppressedAt !== null,
        categories: {
          contest_updates: row.contestUpdates ?? true,
          reminders: row.reminders ?? true,
          judging: row.judging ?? true,
          results: row.results ?? true,
        },
      })
    }
    return result
  },

  /** SES hard bounce / complaint: stop all email to that address. */
  async suppressAddress(email: string, reason: "bounce" | "complaint"): Promise<number> {
    const { db } = getDbClient()
    return withDbWrite("notifications.suppress", () =>
      db.transaction(async (tx) => {
        const users = await tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(sql`lower(${profiles.email}) = lower(${email})`)
        const now = new Date()
        for (const user of users) {
          await tx
            .insert(userEmailPreferences)
            .values({ userId: user.id, suppressedAt: now, suppressedReason: reason })
            .onConflictDoUpdate({
              target: userEmailPreferences.userId,
              set: { suppressedAt: now, suppressedReason: reason, updatedAt: now },
            })
        }
        return users.length
      }),
    )
  },

  // ---------- reminder candidates ----------

  async videoDeadlineCandidates(now: Date, horizon: Date): Promise<VideoDeadlineCandidate[]> {
    const { db } = getDbClient()
    const rows = await withDbRead("notifications.reminders.videoDeadline", () =>
      db
        .select({
          id: sportEvents.id,
          slug: sportEvents.slug,
          name: sportEvents.name,
          timeZone: sportEvents.timezone,
          deadline: sportEvents.submissionDeadlineAt,
          riderId: eventRuns.userId,
        })
        .from(sportEvents)
        .innerJoin(eventRuns, and(eq(eventRuns.eventId, sportEvents.id), eq(eventRuns.status, "scheduled")))
        .innerJoin(
          eventMemberships,
          and(
            eq(eventMemberships.eventId, sportEvents.id),
            eq(eventMemberships.userId, eventRuns.userId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .where(
          and(
            eq(sportEvents.submissionMode, "video"),
            eq(sportEvents.status, "live"),
            isNotNull(sportEvents.submissionDeadlineAt),
            sql`${sportEvents.submissionDeadlineAt} > ${now}`,
            sql`${sportEvents.submissionDeadlineAt} <= ${horizon}`,
          ),
        ),
    )
    const byEvent = new Map<string, VideoDeadlineCandidate & { riderIdsMissingVideo: string[] }>()
    for (const row of rows) {
      if (!row.deadline || !row.riderId) continue
      const entry = byEvent.get(row.id) ?? {
        id: row.id,
        slug: row.slug,
        name: row.name,
        timeZone: row.timeZone,
        deadline: row.deadline,
        riderIdsMissingVideo: [],
      }
      entry.riderIdsMissingVideo.push(row.riderId)
      byEvent.set(row.id, entry)
    }
    return [...byEvent.values()]
  },

  async judgingCandidates(staleBefore: Date): Promise<JudgingCandidate[]> {
    const { db } = getDbClient()
    return withDbRead("notifications.reminders.judging", async () => {
      const runs = await db
        .select({
          eventId: sportEvents.id,
          slug: sportEvents.slug,
          name: sportEvents.name,
          runId: eventRuns.id,
          submittedAt: eventRuns.videoSubmittedAt,
        })
        .from(eventRuns)
        .innerJoin(sportEvents, eq(sportEvents.id, eventRuns.eventId))
        .where(
          and(
            eq(sportEvents.status, "live"),
            inArray(eventRuns.status, ["submitted", "scored"]),
            isNotNull(eventRuns.videoSubmittedAt),
            lt(eventRuns.videoSubmittedAt, staleBefore),
          ),
        )
      if (runs.length === 0) return []
      const eventIds = [...new Set(runs.map((run) => run.eventId))]
      const [judges, scores] = await Promise.all([
        db
          .select({ eventId: eventMemberships.eventId, userId: eventMemberships.userId })
          .from(eventMemberships)
          .where(
            and(
              inArray(eventMemberships.eventId, eventIds),
              eq(eventMemberships.role, "judge"),
              eq(eventMemberships.status, "active"),
            ),
          ),
        db
          .select({ runId: eventScores.runId, judgeId: eventScores.judgeUserId })
          .from(eventScores)
          .where(inArray(eventScores.runId, runs.map((run) => run.runId))),
      ])
      const scoredBy = new Map<string, string[]>()
      for (const score of scores) {
        scoredBy.set(score.runId, [...(scoredBy.get(score.runId) ?? []), score.judgeId])
      }
      const byEvent = new Map<string, JudgingCandidate & { judgeIds: string[]; submittedRuns: { submittedAt: Date; scoredBy: string[] }[] }>()
      for (const run of runs) {
        const entry = byEvent.get(run.eventId) ?? {
          id: run.eventId,
          slug: run.slug,
          name: run.name,
          judgeIds: judges.filter((judge) => judge.eventId === run.eventId).map((judge) => judge.userId),
          submittedRuns: [],
        }
        entry.submittedRuns.push({ submittedAt: run.submittedAt!, scoredBy: scoredBy.get(run.runId) ?? [] })
        byEvent.set(run.eventId, entry)
      }
      return [...byEvent.values()].filter((event) => event.judgeIds.length > 0)
    })
  },

  /** Unsettled, non-terminal contests created in the reminder window (days 1–6). */
  async paymentGateCandidates(createdAfter: Date): Promise<PaymentGateCandidate[]> {
    const { db } = getDbClient()
    const rows = await withDbRead("notifications.reminders.paymentGate", () =>
      db
        .select({
          id: sportEvents.id,
          slug: sportEvents.slug,
          name: sportEvents.name,
          createdAt: sportEvents.createdAt,
          createdBy: sportEvents.createdBy,
          ownerId: sql<string | null>`(
            select ${eventMemberships.userId} from ${eventMemberships}
            where ${eventMemberships.eventId} = ${sportEvents.id}
              and ${eventMemberships.role} = 'main_organizer'
              and ${eventMemberships.status} = 'active'
            limit 1
          )`,
          hasActivePayment: sql<boolean>`exists (
            select 1 from ${eventPayments}
            where ${eventPayments.eventId} = ${sportEvents.id}
              and ${eventPayments.status} in ('paid', 'comped')
          )`,
        })
        .from(sportEvents)
        .where(
          and(
            sql`${sportEvents.status} not in ('completed', 'cancelled')`,
            sql`${sportEvents.createdAt} > ${createdAfter}`,
          ),
        ),
    )
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      createdAt: row.createdAt,
      hasActivePayment: Boolean(row.hasActivePayment),
      ownerId: row.ownerId ?? row.createdBy ?? null,
    }))
  },
}

export type DeliveryStore = Pick<
  typeof deliveryStore,
  | "claimPending"
  | "claimStaleQueued"
  | "expirePending"
  | "expireStale"
  | "setStatus"
  | "loadRecipients"
  | "suppressAddress"
>
