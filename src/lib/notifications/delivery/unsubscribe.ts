/**
 * One-click unsubscribe tokens: `<base64url(userId:category)>.<hmac>`. The
 * token only carries an opaque user id and a category, never an address,
 * and cannot be forged without NOTIFICATIONS_UNSUBSCRIBE_SECRET. Tokens do
 * not expire: an old email's link must keep working (RFC 8058).
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import type { NotificationEmailCategory } from "@/types/league"

const CATEGORIES: ReadonlySet<string> = new Set([
  "contest_updates",
  "reminders",
  "judging",
  "results",
])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sign(secret: string, data: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${data}`).digest("base64url")
}

export function createUnsubscribeToken(
  secret: string,
  userId: string,
  category: NotificationEmailCategory,
): string {
  const data = Buffer.from(`${userId}:${category}`).toString("base64url")
  return `${data}.${sign(secret, data)}`
}

export function readUnsubscribeToken(
  secret: string,
  token: string | null | undefined,
): { userId: string; category: NotificationEmailCategory } | null {
  if (!token) return null
  const [data, signature, extra] = token.split(".")
  if (!data || !signature || extra !== undefined) return null
  const expected = sign(secret, data)
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null
  }
  const [userId, category] = Buffer.from(data, "base64url").toString("utf8").split(":")
  if (!userId || !UUID_PATTERN.test(userId) || !category || !CATEGORIES.has(category)) {
    return null
  }
  return { userId, category: category as NotificationEmailCategory }
}

export function unsubscribeUrl(appUrl: string, token: string): string {
  const url = new URL("/api/notifications/unsubscribe", appUrl)
  url.searchParams.set("token", token)
  return url.toString()
}
