import { describe, expect, it, vi } from "vitest"
import { createDispatcher } from "./dispatcher"
import type { QueueMessage } from "./sqs"
import type { ClaimedNotification, DeliveryStore, Recipient } from "./store"

const APP = "https://openspot.example.com"
const NOW = new Date("2026-11-05T12:00:00.000Z")
const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"

let seq = 0
function row(partial: Partial<ClaimedNotification>): ClaimedNotification {
  seq += 1
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    userId: U1,
    type: "league_event_cancelled",
    payload: { eventName: "Night Jam", eventSlug: "night-jam" },
    urgency: "immediate",
    createdAt: new Date(NOW.getTime() - seq * 1000),
    ...partial,
  }
}

function recipient(userId: string, partial: Partial<Recipient> = {}): Recipient {
  return {
    userId,
    email: `${userId.slice(0, 4)}@example.com`,
    suppressed: false,
    categories: { contest_updates: true, reminders: true, judging: true, results: true },
    ...partial,
  }
}

function setup(input: {
  claimed: ClaimedNotification[]
  recipients: Recipient[]
  failIds?: (messages: readonly QueueMessage[]) => string[]
}) {
  const statuses: Record<string, string[]> = {}
  const store: DeliveryStore = {
    claimPending: vi.fn(async () => input.claimed),
    claimStaleQueued: vi.fn(async () => []),
    expirePending: vi.fn(async () => 0),
    expireStale: vi.fn(async () => 0),
    setStatus: vi.fn(async (ids: readonly string[], status: string) => {
      statuses[status] = [...(statuses[status] ?? []), ...ids]
    }),
    loadRecipients: vi.fn(async () => new Map(input.recipients.map((r) => [r.userId, r]))),
    suppressAddress: vi.fn(async () => 0),
  }
  const sent: QueueMessage[] = []
  const sender = {
    send: vi.fn(async (messages: readonly QueueMessage[]) => {
      sent.push(...messages)
      const failed = new Set(input.failIds?.(messages) ?? [])
      return {
        succeeded: messages.filter((m) => !failed.has(m.id)).map((m) => m.id),
        failed: [...failed].map((id) => ({ id, reason: "boom" })),
      }
    }),
  }
  const dispatcher = createDispatcher({ store, sender, appUrl: APP, unsubscribeSecret: "s", now: () => NOW })
  return { dispatcher, store, sender, sent, statuses }
}

describe("dispatcher", () => {
  it("sends one email per immediate row with an unsubscribe link", async () => {
    const a = row({})
    const { dispatcher, sent } = setup({ claimed: [a], recipients: [recipient(U1)] })
    const counts = await dispatcher.dispatchImmediate([a.id])
    expect(counts).toEqual({ claimed: 1, queued: 1, skipped: 0, retry: 0 })
    expect(sent).toHaveLength(1)
    const job = sent[0]!.job
    expect(job.notificationIds).toEqual([a.id])
    expect(job.subject).toBe("Contest cancelled · Night Jam")
    expect(job.html).toContain(`${APP}/league/night-jam`)
    expect(job.unsubscribeUrl).toContain("/api/notifications/unsubscribe?token=")
    expect(sent[0]!.groupId).toBe(U1)
  })

  it("skips opted-out, suppressed and address-less recipients", async () => {
    const optedOut = row({ userId: U1, type: "league_results_published" })
    const suppressed = row({ userId: U2 })
    const { dispatcher, sent, statuses } = setup({
      claimed: [optedOut, suppressed],
      recipients: [
        recipient(U1, { categories: { contest_updates: true, reminders: true, judging: true, results: false } }),
        recipient(U2, { suppressed: true }),
      ],
    })
    const counts = await dispatcher.dispatchImmediate([optedOut.id, suppressed.id])
    expect(counts.skipped).toBe(2)
    expect(sent).toHaveLength(0)
    expect(statuses.skipped).toEqual([optedOut.id, suppressed.id])
  })

  it("groups digest rows into one email per user and category", async () => {
    const rows = [
      row({ userId: U1, type: "league_video_submitted", urgency: "digest" }),
      row({ userId: U1, type: "league_video_submitted", urgency: "digest" }),
      row({ userId: U1, type: "league_schedule_published", urgency: "digest" }),
      row({ userId: U2, type: "league_video_submitted", urgency: "digest" }),
    ]
    const { dispatcher, sent } = setup({ claimed: rows, recipients: [recipient(U1), recipient(U2)] })
    await dispatcher.dispatchDigests()
    expect(sent).toHaveLength(3)
    const judgingU1 = sent.find((m) => m.groupId === U1 && m.job.category === "judging")!
    expect(judgingU1.job.notificationIds).toHaveLength(2)
    expect(judgingU1.job.subject).toMatch(/^2 League updates/)
    // Stable keys for the same row set.
    expect(judgingU1.job.key).toMatch(/^d:[0-9a-f]{40}$/)
  })

  it("returns rows of a failed enqueue to pending", async () => {
    const a = row({})
    const b = row({ userId: U2 })
    const { dispatcher, statuses } = setup({
      claimed: [a, b],
      recipients: [recipient(U1), recipient(U2)],
      failIds: (messages) => [messages[1]!.id],
    })
    const counts = await dispatcher.dispatchImmediate([a.id, b.id])
    expect(counts).toEqual({ claimed: 2, queued: 1, skipped: 0, retry: 1 })
    expect(statuses.pending).toEqual([b.id])
  })

  it("backstop claims missed immediate rows after the grace period", async () => {
    const { dispatcher, store } = setup({ claimed: [], recipients: [] })
    await dispatcher.runBackstop()
    expect(store.claimPending).toHaveBeenCalledWith(
      expect.objectContaining({ urgency: "immediate", createdBefore: new Date(NOW.getTime() - 2 * 60 * 1000) }),
    )
    expect(store.claimStaleQueued).toHaveBeenCalledWith(
      expect.objectContaining({ queuedBefore: new Date(NOW.getTime() - 60 * 60 * 1000) }),
    )
  })

  it("drops pending rows past their max age before claiming, in both tick paths", async () => {
    const { dispatcher, store } = setup({ claimed: [], recipients: [] })
    vi.mocked(store.expirePending).mockResolvedValueOnce(4)
    const backstop = await dispatcher.runBackstop()
    expect(backstop.expired).toBe(4)
    const bounds = {
      immediateBefore: new Date(NOW.getTime() - 6 * 60 * 60 * 1000),
      digestBefore: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    }
    expect(store.expirePending).toHaveBeenCalledWith(bounds)
    expect(vi.mocked(store.expirePending).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(store.claimPending).mock.invocationCallOrder[0]!,
    )
    await dispatcher.dispatchDigests()
    expect(store.expirePending).toHaveBeenCalledTimes(2)
  })

  it("releases the claim when a read fails before anything is enqueued", async () => {
    const a = row({})
    const { dispatcher, store, sender, statuses } = setup({ claimed: [a], recipients: [recipient(U1)] })
    vi.mocked(store.loadRecipients).mockRejectedValueOnce(new Error("db down"))
    await expect(dispatcher.dispatchImmediate([a.id])).rejects.toThrow("db down")
    expect(statuses.pending).toEqual([a.id])
    expect(sender.send).not.toHaveBeenCalled()
  })

  it("caps a long digest and still marks every row", async () => {
    const rows = Array.from({ length: 15 }, () =>
      row({ type: "league_video_submitted", urgency: "digest", payload: { eventName: "Night Jam", eventSlug: "night-jam" } }),
    )
    const { dispatcher, sent } = setup({ claimed: rows, recipients: [recipient(U1)] })
    await dispatcher.dispatchDigests()
    expect(sent).toHaveLength(1)
    const job = sent[0]!.job
    expect(job.notificationIds).toHaveLength(15)
    expect(job.html.match(/Open in OpenSpot/g)).toHaveLength(12)
    expect(job.html).toContain("and 3 more")
    expect(job.text).toContain("and 3 more")
  })
})
