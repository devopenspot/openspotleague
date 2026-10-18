/**
 * Notification fan-out — writes `user_notifications` rows inside the same
 * transaction as the triggering league mutation (no queue, no PGMQ; see
 * plan.league.spec.md decisions). Realtime delivery rides the
 * `supabase_realtime` publication on the per-user channel.
 */

import "server-only"

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm"
import { getDbClient, withDbRead, withDbWrite } from "@/lib/db/client"
import { renderNotification } from "@/lib/notifications/definitions"
import {
  eventMemberships,
  permissions,
  rolePermissions,
  userEmailPreferences,
  userNotifications,
  userRoles,
  type NewUserNotificationRow,
} from "@/db/schema"
import type {
  EventRole,
  NotificationPayload,
  NotificationType,
} from "@/types/sport-events"

type Db = ReturnType<typeof getDbClient>["db"]
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

const INSERT_CHUNK = 200

export interface NotificationDraft {
  userId: string
  type: NotificationType
  payload?: NotificationPayload
  eventId?: string | null
}

export async function createNotifications(
  tx: Tx,
  drafts: readonly NotificationDraft[],
): Promise<void> {
  if (drafts.length === 0) return
  const rows: NewUserNotificationRow[] = drafts.map((draft) => ({
    userId: draft.userId,
    type: draft.type,
    payload: draft.payload ?? {},
    eventId: draft.eventId ?? null,
  }))
  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    await tx.insert(userNotifications).values(rows.slice(index, index + INSERT_CHUNK))
  }
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
 * Feature detection for the email surface (0031): boolean presence of a
 * usable resend_api_key in Vault — never exposes the value. The UI hides
 * the digest toggle while this is false; everything else is unaffected.
 */
export async function isEmailDeliveryAvailable(): Promise<boolean> {
  const { db } = getDbClient()
  return withDbRead("notifications.emailDeliveryStatus", () =>
    db.transaction(async (tx): Promise<boolean> => {
      const [row] = await tx
        .select({
          available: sql<boolean>`league_email_delivery_available()`,
        })
        .from(sql`(select 1) as probe`)
      return Boolean(row?.available)
    }),
  )
}

/**
 * Email-digest preference (default on): the daily pg_cron sweep reads
 * `user_email_preferences` before sending, so an absent row means enabled.
 */
export async function getEmailDigestsEnabled(
  userId: string,
): Promise<{ emailDigests: boolean }> {
  const { db } = getDbClient()
  return withDbRead("notifications.emailPrefs", () =>
    db.transaction(async (tx): Promise<{ emailDigests: boolean }> => {
      const [row] = await tx
        .select({ enabled: userEmailPreferences.emailDigestsEnabled })
        .from(userEmailPreferences)
        .where(eq(userEmailPreferences.userId, userId))
        .limit(1)
      return { emailDigests: row?.enabled ?? true }
    }),
  )
}

export async function setEmailDigests(
  userId: string,
  emailDigests: boolean,
): Promise<{ emailDigests: boolean }> {
  const { db } = getDbClient()
  return withDbWrite("notifications.setEmailDigests", () =>
    db.transaction(async (tx): Promise<{ emailDigests: boolean }> => {
      await tx
        .insert(userEmailPreferences)
        .values({ userId, emailDigestsEnabled: emailDigests })
        .onConflictDoUpdate({
          target: userEmailPreferences.userId,
          set: { emailDigestsEnabled: emailDigests, updatedAt: new Date() },
        })
      return { emailDigests }
    }),
  )
}
