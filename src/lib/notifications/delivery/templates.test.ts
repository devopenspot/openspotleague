import { describe, expect, it } from "vitest"
import { DIGEST_ITEM_LIMIT, renderDigestEmail, renderSingleEmail } from "./templates"

const base = {
  appUrl: "https://openspot.example.com",
  category: "contest_updates" as const,
  unsubscribeUrl: "https://openspot.example.com/api/notifications/unsubscribe?token=t",
}

describe("email templates", () => {
  it("removes control characters from the subject", () => {
    const { subject } = renderSingleEmail({
      ...base,
      notification: {
        type: "league_event_cancelled",
        payload: { eventName: "Night\r\nBcc: x@example.com\tJam", eventSlug: "night-jam" },
      },
    })
    expect(subject).toBe("Contest cancelled · Night Bcc: x@example.com Jam")
    expect(subject).not.toMatch(/[\r\n\t]/)
  })

  it("escapes user text and leads with a hidden preview line", () => {
    const { html } = renderSingleEmail({
      ...base,
      notification: {
        type: "league_event_cancelled",
        payload: { eventName: "<b>Jam</b>", eventSlug: "jam" },
      },
    })
    expect(html).not.toContain("<b>Jam</b>")
    const preview = html.indexOf("display:none")
    expect(preview).toBeGreaterThan(-1)
    expect(preview).toBeLessThan(html.indexOf("<table"))
    expect(html.slice(preview, html.indexOf("<table"))).toContain("&lt;b&gt;Jam&lt;/b&gt; was cancelled")
  })

  it("lists at most the digest limit and counts the rest", () => {
    const notifications = Array.from({ length: DIGEST_ITEM_LIMIT + 5 }, () => ({
      type: "league_schedule_published" as const,
      payload: { eventName: "Night Jam", eventSlug: "night-jam" },
    }))
    const { subject, html, text } = renderDigestEmail({ ...base, notifications })
    expect(subject).toMatch(new RegExp(`^${DIGEST_ITEM_LIMIT + 5} League updates`))
    expect(html.match(/Open in OpenSpot/g)).toHaveLength(DIGEST_ITEM_LIMIT)
    expect(html).toContain("and 5 more in your inbox")
    expect(text).toContain("and 5 more in your inbox: https://openspot.example.com/notifications")
  })

  it("adds no extra line when everything fits", () => {
    const notifications = [1, 2].map(() => ({
      type: "league_schedule_published" as const,
      payload: { eventName: "Night Jam", eventSlug: "night-jam" },
    }))
    expect(renderDigestEmail({ ...base, notifications }).html).not.toContain("more in your inbox")
  })
})
