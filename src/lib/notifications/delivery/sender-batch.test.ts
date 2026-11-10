import { describe, expect, it, vi } from "vitest"
import type { EmailJob } from "./contract"
import { PermanentSendError, processEmailBatch, type BatchRecord } from "./sender-batch"

const quiet = { warn: vi.fn(), error: vi.fn() }

let seq = 0
function record(groupId: string, overrides: Partial<EmailJob> = {}): BatchRecord & { job: EmailJob } {
  seq += 1
  const job: EmailJob = {
    v: 1,
    channel: "email",
    key: `n:${seq}`,
    notificationIds: [`00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`],
    to: "rider@example.com",
    subject: "Contest cancelled",
    html: "<p>hi</p>",
    text: "hi",
    category: "contest_updates",
    unsubscribeUrl: "https://openspot.example.com/api/notifications/unsubscribe?token=x",
    ...overrides,
  }
  return { messageId: `m${seq}`, groupId, body: JSON.stringify(job), job }
}

describe("processEmailBatch", () => {
  it("reports every sent email", async () => {
    const records = [record("u1"), record("u2")]
    const outcome = await processEmailBatch(records, async () => ({ messageId: "ses-1" }), quiet)
    expect(outcome.failedMessageIds).toEqual([])
    expect(outcome.reports).toEqual(
      records.map((r) => ({
        kind: "job",
        notificationIds: r.job.notificationIds,
        status: "sent",
        sesMessageId: "ses-1",
      })),
    )
  })

  it("on a retryable error holds back the rest of that user's emails only", async () => {
    const [a1, b1, a2, b2] = [record("a"), record("b"), record("a"), record("b")]
    const send = vi.fn(async (job: EmailJob) => {
      if (job.key === a1!.job.key) throw new Error("ThrottlingException: slow down rider@example.com")
      return { messageId: "ok" }
    })
    const outcome = await processEmailBatch([a1!, b1!, a2!, b2!], send, quiet)
    expect(outcome.failedMessageIds).toEqual([a1!.messageId, a2!.messageId])
    expect(outcome.reports.map((r) => (r.kind === "job" ? r.notificationIds[0] : null))).toEqual([
      b1!.job.notificationIds[0],
      b2!.job.notificationIds[0],
    ])
    // The held-back email is never attempted out of order.
    expect(send).toHaveBeenCalledTimes(3)
  })

  it("reports a permanent failure once and keeps going", async () => {
    const [bad, next] = [record("a"), record("a")]
    const send = vi.fn(async (job: EmailJob) => {
      if (job.key === bad!.job.key) throw new PermanentSendError("MessageRejected")
      return { messageId: "ok" }
    })
    const outcome = await processEmailBatch([bad!, next!], send, quiet)
    expect(outcome.failedMessageIds).toEqual([])
    expect(outcome.reports).toEqual([
      { kind: "job", notificationIds: bad!.job.notificationIds, status: "failed", reason: "MessageRejected" },
      { kind: "job", notificationIds: next!.job.notificationIds, status: "sent", sesMessageId: "ok" },
    ])
  })

  it("drops an unparseable record without retrying or reporting it", async () => {
    const good = record("a")
    const send = vi.fn(async () => ({ messageId: "ok" }))
    const outcome = await processEmailBatch(
      [{ messageId: "junk", groupId: "a", body: "{not json" }, { ...record("a"), body: "{}" }, good],
      send,
      quiet,
    )
    expect(outcome.failedMessageIds).toEqual([])
    expect(outcome.reports).toHaveLength(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("never logs the provider's error text", async () => {
    const logger = { warn: vi.fn(), error: vi.fn() }
    await processEmailBatch(
      [record("a")],
      async () => {
        throw new Error("Address rider@example.com is throttled")
      },
      logger,
    )
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("rider@example.com")
  })
})
