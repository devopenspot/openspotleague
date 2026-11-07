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

function layout(input: {
  heading: string
  items: readonly Item[]
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
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;background:#f7f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb"><tr><td align="center" style="padding:24px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:24px">
      <tr><td style="padding-bottom:8px">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#74777a">OpenSpot League</p>
        <h1 style="margin:4px 0 0;font-size:22px;color:#121212">${escapeHtml(input.heading)}</h1>
      </td></tr>
      ${rows}
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#74777a">
      You get these because you take part in OpenSpot League contests.
      <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#44474a">Unsubscribe from ${escapeHtml(categoryLabel(input.category))}</a>
      · <a href="${escapeHtml(settings)}" style="color:#44474a">Email settings</a>
    </p>
  </td></tr></table>
</body></html>`
}

function textBody(heading: string, items: readonly Item[], category: NotificationEmailCategory, unsubscribe: string): string {
  const lines = [heading, ""]
  for (const item of items) {
    lines.push(item.title, item.body, item.href, "")
  }
  lines.push(`Unsubscribe from ${categoryLabel(category)}: ${unsubscribe}`)
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
  return {
    subject: subject.slice(0, 200),
    html: layout({ heading: item.title, items: [item], appUrl: input.appUrl, category: input.category, unsubscribeUrl: input.unsubscribeUrl }),
    text: textBody(item.title, [item], input.category, input.unsubscribeUrl),
  }
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
  const items = input.notifications.map((notification) => toItem(input.appUrl, notification))
  const heading = `${items.length} League updates`
  return {
    subject: `${heading}: ${items[0]!.title}`.slice(0, 200),
    html: layout({ heading, items, appUrl: input.appUrl, category: input.category, unsubscribeUrl: input.unsubscribeUrl }),
    text: textBody(heading, items, input.category, input.unsubscribeUrl),
  }
}
