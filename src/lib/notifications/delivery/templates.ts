/**
 * Email bodies for notification delivery: plain string templates (no React
 * Email, to keep the Worker bundle small), built from the same
 * `renderNotification` copy the in-app inbox shows. Every value is escaped;
 * links are absolute (`appUrl`) because mail clients have no base URL.
 * Monochrome surface palette from DESIGN.md, inline styles only.
 */

import { notificationHref, renderNotification } from "@/lib/notifications/definitions"
import type { NotificationEmailCategory, NotificationPayload, NotificationType } from "@/types/league"

export interface TemplateNotification {
  type: NotificationType
  payload: NotificationPayload
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const CATEGORY_LABELS: Record<NotificationEmailCategory, string> = {
  contest_updates: "contest updates",
  reminders: "reminders",
  judging: "judging alerts",
  results: "results",
}

export function categoryLabel(category: NotificationEmailCategory): string {
  return CATEGORY_LABELS[category]
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/** A digest lists this many notifications; the rest are a count and a link. */
export const DIGEST_ITEM_LIMIT = 12

/**
 * Contest names are user input. A line break or other control character in a
 * subject makes SES reject the whole email, so they collapse to spaces.
 */
function cleanSubject(value: string): string {
  return value.replace(/\p{Cc}+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 200)
}

function absolute(appUrl: string, path: string | null): string {
  return new URL(path ?? "/notifications", appUrl).toString()
}

interface Item {
  title: string
  body: string
  href: string
}

function toItem(appUrl: string, notification: TemplateNotification): Item {
  const copy = renderNotification(notification.type, notification.payload)
  return {
    ...copy,
    href: absolute(appUrl, notificationHref(notification.type, notification.payload)),
  }
}

function moreLine(more: number): string {
  return `and ${more} more in your inbox`
}

function layout(input: {
  heading: string
  items: readonly Item[]
  /** Notifications left out of `items` (digest over the limit). */
  more?: number
  appUrl: string
  category: NotificationEmailCategory
  unsubscribeUrl: string
}): string {
  const rows = input.items
    .map(
      (item) => `
        <tr><td style="padding:16px 0;border-top:1px solid #e1e5e9">
          <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#121212">${escapeHtml(item.title)}</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#44474a">${escapeHtml(item.body)}</p>
          <a href="${escapeHtml(item.href)}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">Open in OpenSpot</a>
        </td></tr>`,
    )
    .join("")
  const settings = absolute(input.appUrl, "/notifications")
  const more = input.more
    ? `
        <tr><td style="padding:16px 0;border-top:1px solid #e1e5e9">
          <a href="${escapeHtml(settings)}" style="font-size:15px;font-weight:600;color:#121212">${escapeHtml(moreLine(input.more))}</a>
        </td></tr>`
    : ""
  // Hidden preview text: mail clients show it next to the subject.
  const preheader = input.items[0]?.body ?? ""
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;background:#f7f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb"><tr><td align="center" style="padding:24px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:24px">
      <tr><td style="padding-bottom:8px">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#74777a">OpenSpot League</p>
        <h1 style="margin:4px 0 0;font-size:22px;color:#121212">${escapeHtml(input.heading)}</h1>
      </td></tr>
      ${rows}${more}
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#74777a">
      You get these because you take part in OpenSpot League contests.
      <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#44474a">Unsubscribe from ${escapeHtml(categoryLabel(input.category))}</a>
      · <a href="${escapeHtml(settings)}" style="color:#44474a">Email settings</a>
    </p>
  </td></tr></table>
</body></html>`
}

function textBody(input: {
  heading: string
  items: readonly Item[]
  more?: number
  appUrl: string
  category: NotificationEmailCategory
  unsubscribeUrl: string
}): string {
  const lines = [input.heading, ""]
  for (const item of input.items) {
    lines.push(item.title, item.body, item.href, "")
  }
  if (input.more) lines.push(`${moreLine(input.more)}: ${absolute(input.appUrl, "/notifications")}`, "")
  lines.push(`Unsubscribe from ${categoryLabel(input.category)}: ${input.unsubscribeUrl}`)
  return lines.join("\n")
}

/** One notification, one email (immediate urgency). */
export function renderSingleEmail(input: {
  appUrl: string
  notification: TemplateNotification
  category: NotificationEmailCategory
  unsubscribeUrl: string
}): RenderedEmail {
  const item = toItem(input.appUrl, input.notification)
  const subject = input.notification.payload.eventName
    ? `${item.title} · ${input.notification.payload.eventName}`
    : item.title
  const content = {
    heading: item.title,
    items: [item],
    appUrl: input.appUrl,
    category: input.category,
    unsubscribeUrl: input.unsubscribeUrl,
  }
  return { subject: cleanSubject(subject), html: layout(content), text: textBody(content) }
}

/** Several digest-urgency notifications for one user and category. */
export function renderDigestEmail(input: {
  appUrl: string
  notifications: readonly TemplateNotification[]
  category: NotificationEmailCategory
  unsubscribeUrl: string
}): RenderedEmail {
  if (input.notifications.length === 1) {
    return renderSingleEmail({ ...input, notification: input.notifications[0]! })
  }
  const total = input.notifications.length
  const items = input.notifications
    .slice(0, DIGEST_ITEM_LIMIT)
    .map((notification) => toItem(input.appUrl, notification))
  const heading = `${total} League updates`
  const content = {
    heading,
    items,
    more: total - items.length,
    appUrl: input.appUrl,
    category: input.category,
    unsubscribeUrl: input.unsubscribeUrl,
  }
  return {
    subject: cleanSubject(`${heading}: ${items[0]!.title}`),
    html: layout(content),
    text: textBody(content),
  }
}
