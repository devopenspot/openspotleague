/**
 * Notification fan-out — writes `user_notifications` rows inside the same
 * transaction as the triggering league mutation. Realtime in-app delivery
 * rides the `supabase_realtime` publication on the per-user channel. The
 * same rows are the email outbox: email-eligible types are inserted
 * `pending`, and immediate ones are handed to the SQS queue after commit
 * (see docs/notifications.md).
 */

import "server-only"

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm"
import { getDbClient, withDbRead, withDbWrite } from "@/lib/db/client"
import { EMAIL_CATEGORIES, emailPolicyFor, renderNotification } from "@/lib/notifications/definitions"
import { isEmailDeliveryConfigured, queueImmediateEmails } from "@/lib/notifications/delivery"
import {
  eventMemberships,
  permissions,
  rolePermissions,
  userEmailPreferences,
  userNotifications,
  userRoles,
  type NewUserNotificationRow,
} from "@/db/schema"
import type { EventRole, NotificationEmailCategory, NotificationPayload, NotificationType } from "@/types/league"

type Db = ReturnType<typeof getDbClient>["db"]
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

const INSERT_CHUNK = 200

export interface NotificationDraft {
  userId: string
  type: NotificationType
  payload?: NotificationPayload
  eventId?: string | null
  /** Idempotency key (unique): a repeat insert with the same key is dropped. */
  dedupeKey?: string
}

/**
 * Inserts the rows (skipping duplicate `dedupeKey`s) and queues the
 * immediate-urgency ones for email after the transaction commits. Returns
 * the ids actually inserted.
 *
 * Rows enter the email outbox only while delivery is configured. Otherwise
 * they stay in-app only, so turning email on later never sends old mail.
 */
export async function createNotifications(
  tx: Tx,
  drafts: readonly NotificationDraft[],
): Promise<string[]> {
  if (drafts.length === 0) return []
  const emailOn = isEmailDeliveryConfigured()
  const rows: NewUserNotificationRow[] = drafts.map((draft) => {
    const urgency = emailOn ? emailPolicyFor(draft.type).urgency : null
    return {
      userId: draft.userId,
      type: draft.type,
      payload: draft.payload ?? {},
      eventId: draft.eventId ?? null,
      dedupeKey: draft.dedupeKey ?? null,
      emailStatus: urgency ? "pending" : null,
      emailUrgency: urgency,
    }
  })
  const inserted: { id: string; urgency: string | null }[] = []
  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    const chunk = await tx
      .insert(userNotifications)
      .values(rows.slice(index, index + INSERT_CHUNK))
      .onConflictDoNothing()
      .returning({ id: userNotifications.id, urgency: userNotifications.emailUrgency })
    inserted.push(...chunk)
  }
  queueImmediateEmails(inserted.filter((row) => row.urgency === "immediate").map((row) => row.id))
  return inserted.map((row) => row.id)
}

/**
 * Active members of an event, optionally filtered by role. Recipients are
 * resolved from `event_memberships` so fan-out always matches live state.
 */
export async function resolveEventRecipients(
  tx: Tx,
  input: {
    eventId: string;
    roles?: readonly EventRole[];
    excludeUserIds?: readonly string[];
  },
): Promise<string[]> {
  const conditions = [
    eq(eventMemberships.eventId, input.eventId),
    eq(eventMemberships.status, "active"),
  ]
  if (input.roles && input.roles.length > 0) {
    conditions.push(inArray(eventMemberships.role, [...input.roles]))
  }
  const rows = await tx
    .select({ userId: eventMemberships.userId })
    .from(eventMemberships)
    .where(and(...conditions))
  const excluded = new Set(input.excludeUserIds ?? [])
  const seen = new Set<string>()
  const recipients: string[] = []
  for (const row of rows) {
    if (excluded.has(row.userId) || seen.has(row.userId)) continue
    seen.add(row.userId)
    recipients.push(row.userId)
  }
  return recipients
}

/**
 * Users holding the `league.manage` permission (role → permission join) —
 * the admin alert audience for pending payments.
 */
export async function resolveLeagueManageAdmins(tx: Tx): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(permissions.slug, "league.manage"))
  return rows.map((row) => row.userId)
}

export async function notifyLeagueManageAdmins(
  tx: Tx,
  input: { type: NotificationType; payload: NotificationPayload; eventId?: string },
): Promise<void> {
  const admins = await resolveLeagueManageAdmins(tx)
  await createNotifications(
    tx,
    admins.map((userId) => ({
      userId,
      type: input.type,
      payload: input.payload,
      eventId: input.eventId ?? null,
    })),
  )
}

/** Unread count for the bell badge. */
export async function countUnreadNotifications(
  tx: Tx,
  userId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), sql`${userNotifications.readAt} is null`))
  return row?.count ?? 0
}

// ---------- owner reads (route-facing) ----------

export interface NotificationItem {
  id: string
  type: NotificationType
  payload: NotificationPayload
  title: string
  body: string
  eventId: string | null
  readAt: string | null
  createdAt: string
}

export interface ListNotificationsResult {
  items: NotificationItem[]
  unreadCount: number
  nextCursor: string | null
}

const MAX_PAGE_SIZE = 50

/**
 * Keyset-paginated notification list for the owner (newest first), with
 * rendered copy inline so the client never re-derives wording.
 */
export function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; before?: string } = {},
): Promise<ListNotificationsResult> {
  const { db } = getDbClient()
  return withDbRead("notifications.list", () =>
    db.transaction(
      async (tx): Promise<ListNotificationsResult> => {
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? 20))
        const conditions = [eq(userNotifications.userId, userId)]
        if (options.unreadOnly) {
          conditions.push(sql`${userNotifications.readAt} is null`)
        }
        if (options.before) {
          const before = new Date(options.before)
          if (!Number.isNaN(before.getTime())) {
            conditions.push(lt(userNotifications.createdAt, before))
          }
        }
        const rows = await tx
          .select()
          .from(userNotifications)
          .where(and(...conditions))
          .orderBy(desc(userNotifications.createdAt))
          .limit(limit + 1)
        const hasMore = rows.length > limit
        const page = hasMore ? rows.slice(0, limit) : rows
        const unreadCount = await countUnreadNotifications(tx, userId)
        return {
          items: page.map((row) => {
            const payload = row.payload
            const copy = renderNotification(row.type, payload)
            return {
              id: row.id,
              type: row.type,
              payload,
              title: copy.title,
              body: copy.body,
              eventId: row.eventId,
              readAt: row.readAt?.toISOString() ?? null,
              createdAt: row.createdAt.toISOString(),
            }
          }),
          unreadCount,
          nextCursor: hasMore
            ? page[page.length - 1]?.createdAt.toISOString() ?? null
            : null,
        }
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    ),
  )
}

export async function markNotificationsRead(
  userId: string,
  input: { ids?: readonly string[]; all?: boolean },
): Promise<{ updated: number }> {
  const { db } = getDbClient()
  return withDbWrite("notifications.markRead", () =>
    db.transaction(async (tx): Promise<{ updated: number }> => {
      const now = new Date()
      const conditions = [eq(userNotifications.userId, userId)]
      if (!input.all && input.ids) {
        conditions.push(inArray(userNotifications.id, [...input.ids]))
      }
      const updated = await tx
        .update(userNotifications)
        .set({ readAt: now })
        .where(
          and(
            ...conditions,
            sql`${userNotifications.readAt} is null`,
          ),
        )
        .returning({ id: userNotifications.id })
      return { updated: updated.length }
    }),
  )
}

/**
 * Whether email delivery is wired (AWS + unsubscribe secrets present). The
 * UI hides the email toggles while this is false; in-app is unaffected.
 */
export async function isEmailDeliveryAvailable(): Promise<boolean> {
  return isEmailDeliveryConfigured()
}

export type EmailPreferences = Record<NotificationEmailCategory, boolean> & {
  /** Set after a hard bounce or complaint: no email is sent at all. */
  suppressed: boolean
}

const DEFAULT_PREFERENCES: EmailPreferences = {
  contest_updates: true,
  reminders: true,
  judging: true,
  results: true,
  suppressed: false,
}

/** Per-category email preferences (an absent row means all on). */
export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const { db } = getDbClient()
  return withDbRead("notifications.emailPrefs", async () => {
    const [row] = await db
      .select({
        contestUpdates: userEmailPreferences.contestUpdates,
        reminders: userEmailPreferences.reminders,
        judging: userEmailPreferences.judging,
        results: userEmailPreferences.results,
        suppressedAt: userEmailPreferences.suppressedAt,
      })
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId))
      .limit(1)
    if (!row) return { ...DEFAULT_PREFERENCES }
    return {
      contest_updates: row.contestUpdates,
      reminders: row.reminders,
      judging: row.judging,
      results: row.results,
      suppressed: row.suppressedAt !== null,
    }
  })
}

const PREFERENCE_COLUMNS = {
  contest_updates: "contestUpdates",
  reminders: "reminders",
  judging: "judging",
  results: "results",
} as const satisfies Record<NotificationEmailCategory, string>

/**
 * Updates the given categories. Turning anything on also lifts a suppression,
 * so a user whose mailbox bounced once can opt back in.
 */
export async function setEmailPreferences(
  userId: string,
  patch: Partial<Record<NotificationEmailCategory, boolean>>,
): Promise<EmailPreferences> {
  const { db } = getDbClient()
  const set: Partial<typeof userEmailPreferences.$inferInsert> = { updatedAt: new Date() }
  for (const category of EMAIL_CATEGORIES) {
    const value = patch[category]
    if (typeof value === "boolean") set[PREFERENCE_COLUMNS[category]] = value
  }
  if (Object.values(patch).some((value) => value === true)) {
    set.suppressedAt = null
    set.suppressedReason = null
  }
  await withDbWrite("notifications.setEmailPrefs", () =>
    db
      .insert(userEmailPreferences)
      .values({ userId, ...set })
      .onConflictDoUpdate({ target: userEmailPreferences.userId, set }),
  )
  return getEmailPreferences(userId)
}
