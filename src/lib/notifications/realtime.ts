/**
 * Which realtime changes on `user_notifications` the inbox must react to.
 *
 * The table doubles as the email outbox, so a row is also UPDATEd when its
 * email is queued and sent. Those changes alter nothing the inbox shows.
 * Refetching on them would cost every open tab one or two extra requests
 * per emailed notification.
 *
 * The only inbox-visible UPDATE is marking a row read, which always sets
 * `read_at`. So an UPDATE whose row is still unread is outbox bookkeeping.
 * An outbox update on an already-read row still refreshes: rare, harmless.
 */
export function shouldRefreshOnChange(change: { eventType?: string; new?: unknown }): boolean {
  if (change.eventType !== "UPDATE") return true
  const row = change.new
  // No usable row: refresh, never risk a stale inbox.
  if (typeof row !== "object" || row === null || !("read_at" in row)) return true
  return row.read_at !== null
}
