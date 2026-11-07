import { NextResponse, type NextRequest } from "next/server"
import { categoryLabel, escapeHtml } from "@/lib/notifications/delivery/templates"
import { unsubscribeByToken } from "@/lib/notifications/delivery/service"
import { log } from "@/lib/utils/log"

/**
 * One-click unsubscribe target for League emails (RFC 8058).
 * - GET (a person clicking the footer link) only shows a confirm button,
 *   so link scanners and prefetchers cannot unsubscribe anyone.
 * - POST (the button, or a mail client's `List-Unsubscribe-Post`) turns the
 *   token's category off. The token is HMAC-signed; no session needed.
 */

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f7f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#121212">
<main style="max-width:480px;margin:48px auto;padding:24px 20px;background:#fff;border-radius:16px">
<p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#74777a">OpenSpot League</p>
<h1 style="margin:4px 0 12px;font-size:22px">${escapeHtml(title)}</h1>
${body}
</main></body></html>`
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

const INVALID = () =>
  page(
    "Link not valid",
    `<p style="font-size:15px;line-height:1.5;color:#44474a">This unsubscribe link is invalid or email is not set up. You can change email settings from your notifications page.</p>`,
    400,
  )

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) return INVALID()
  const action = `/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`
  return page(
    "Unsubscribe",
    `<p style="font-size:15px;line-height:1.5;color:#44474a">Stop this kind of League email? You'll still see it in your in-app notifications.</p>
<form method="post" action="${escapeHtml(action)}"><button type="submit" style="height:44px;padding:0 24px;border:1px solid #0a0a0a;border-radius:999px;background:#0a0a0a;color:#fff;font-size:16px;font-weight:600;cursor:pointer">Unsubscribe</button></form>`,
  )
}

export async function POST(request: NextRequest) {
  try {
    const result = await unsubscribeByToken(request.nextUrl.searchParams.get("token"))
    if (!result) return INVALID()
    return page(
      "You're unsubscribed",
      `<p style="font-size:15px;line-height:1.5;color:#44474a">You won't get ${escapeHtml(categoryLabel(result.category))} emails any more. Turn them back on anytime from your notifications page.</p>
<p><a href="/notifications" style="color:#121212;font-weight:600">Email settings</a></p>`,
    )
  } catch (error) {
    log.error("notifications.unsubscribe_failed", error)
    return page("Something went wrong", `<p style="font-size:15px;color:#44474a">Please try again in a moment.</p>`, 500)
  }
}
