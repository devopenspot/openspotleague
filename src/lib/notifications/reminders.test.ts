import { describe, expect, it } from "vitest"
import {
  DAY_MS,
  HOUR_MS,
  selectJudgingReminders,
  selectPaymentGateReminders,
  selectVideoDeadlineReminders,
} from "./reminders"

const NOW = new Date("2026-11-05T12:00:00.000Z")
const EVENT = { id: "e1", slug: "night-jam", name: "Night Jam" }

describe("selectVideoDeadlineReminders", () => {
  it("reminds riders missing a video inside the 24h window", () => {
    const drafts = selectVideoDeadlineReminders(
      [{ ...EVENT, deadline: new Date(NOW.getTime() + 23 * HOUR_MS), riderIdsMissingVideo: ["r1", "r2", "r1"] }],
      NOW,
    )
    const deadline = new Date(NOW.getTime() + 23 * HOUR_MS)
    expect(drafts.map((d) => d.userId)).toEqual(["r1", "r2"])
    expect(drafts[0]?.dedupeKey).toBe(`vdl24:e1:r1:${deadline.getTime()}`)
    expect(drafts[0]?.payload.dueAt).toBe(deadline.toISOString())
    expect(drafts[0]?.payload.timeZone).toBeUndefined()
  })

  it("reminds again when the deadline moves, and carries the contest time zone", () => {
    const candidate = { ...EVENT, timeZone: "America/Bogota", riderIdsMissingVideo: ["r1"] }
    const [first] = selectVideoDeadlineReminders(
      [{ ...candidate, deadline: new Date(NOW.getTime() + 20 * HOUR_MS) }],
      NOW,
    )
    const [moved] = selectVideoDeadlineReminders(
      [{ ...candidate, deadline: new Date(NOW.getTime() + 22 * HOUR_MS) }],
      NOW,
    )
    expect(first?.dedupeKey).not.toBe(moved?.dedupeKey)
    expect(first?.payload.timeZone).toBe("America/Bogota")
  })

  it("skips deadlines too far out or already passed", () => {
    for (const offset of [25 * HOUR_MS, -HOUR_MS, 0]) {
      expect(
        selectVideoDeadlineReminders(
          [{ ...EVENT, deadline: new Date(NOW.getTime() + offset), riderIdsMissingVideo: ["r1"] }],
          NOW,
        ),
      ).toEqual([])
    }
  })
})

describe("selectJudgingReminders", () => {
  const stale = new Date(NOW.getTime() - DAY_MS - HOUR_MS)
  const fresh = new Date(NOW.getTime() - HOUR_MS)

  it("reminds on day 1, 3 and 7 of the oldest waiting video, then stops", () => {
    const submittedAt = new Date("2026-11-01T12:00:00.000Z")
    const candidate = { ...EVENT, judgeIds: ["j1"], submittedRuns: [{ submittedAt, scoredBy: [] }] }
    const sentOn: number[] = []
    const keys = new Set<string>()
    // Every 15-minute tick for ten days.
    for (let tick = 0; tick < 10 * 24 * 4; tick += 1) {
      const now = new Date(submittedAt.getTime() + tick * 15 * 60 * 1000)
      for (const draft of selectJudgingReminders([candidate], now)) {
        if (keys.has(draft.dedupeKey)) continue
        keys.add(draft.dedupeKey)
        sentOn.push(Math.floor((now.getTime() - submittedAt.getTime()) / DAY_MS))
      }
    }
    expect(sentOn).toEqual([1, 3, 7])
  })

  it("restarts the count from the next oldest video once the oldest is scored", () => {
    const first = new Date(NOW.getTime() - 3 * DAY_MS - HOUR_MS)
    const second = new Date(NOW.getTime() - DAY_MS - HOUR_MS)
    const [draft] = selectJudgingReminders(
      [
        {
          ...EVENT,
          judgeIds: ["j1"],
          submittedRuns: [
            { submittedAt: first, scoredBy: ["j1"] },
            { submittedAt: second, scoredBy: [] },
          ],
        },
      ],
      NOW,
    )
    expect(draft?.dedupeKey).toBe(`jdg:e1:j1:${second.getTime()}:1`)
  })

  it("counts stale runs each judge has not scored", () => {
    const drafts = selectJudgingReminders(
      [
        {
          ...EVENT,
          judgeIds: ["j1", "j2"],
          submittedRuns: [
            { submittedAt: stale, scoredBy: ["j1"] },
            { submittedAt: stale, scoredBy: [] },
            { submittedAt: fresh, scoredBy: [] },
          ],
        },
      ],
      NOW,
    )
    expect(drafts).toEqual([
      expect.objectContaining({
        userId: "j1",
        payload: expect.objectContaining({ pendingCount: 1 }),
        dedupeKey: `jdg:e1:j1:${stale.getTime()}:1`,
      }),
      expect.objectContaining({ userId: "j2", payload: expect.objectContaining({ pendingCount: 2 }) }),
    ])
  })

  it("is quiet when only fresh runs wait", () => {
    expect(
      selectJudgingReminders(
        [{ ...EVENT, judgeIds: ["j1"], submittedRuns: [{ submittedAt: fresh, scoredBy: [] }] }],
        NOW,
      ),
    ).toEqual([])
  })
})

describe("selectPaymentGateReminders", () => {
  const base = { ...EVENT, hasActivePayment: false, ownerId: "o1" }

  it("warns the day before the lock (day 2)", () => {
    const createdAt = new Date(NOW.getTime() - 2 * DAY_MS - HOUR_MS)
    const [draft] = selectPaymentGateReminders([{ ...base, createdAt }], NOW)
    expect(draft?.payload.gateStep).toBe("lock")
    expect(draft?.dedupeKey).toBe("pay:e1:lock")
  })

  it("warns the day before disabling (day 5)", () => {
    const createdAt = new Date(NOW.getTime() - 5 * DAY_MS - HOUR_MS)
    const [draft] = selectPaymentGateReminders([{ ...base, createdAt }], NOW)
    expect(draft?.payload.gateStep).toBe("disable")
  })

  it("stays quiet on day 1, once settled, or without an owner", () => {
    const createdAt = new Date(NOW.getTime() - DAY_MS)
    expect(selectPaymentGateReminders([{ ...base, createdAt }], NOW)).toEqual([])
    const due = new Date(NOW.getTime() - 2 * DAY_MS - HOUR_MS)
    expect(selectPaymentGateReminders([{ ...base, createdAt: due, hasActivePayment: true }], NOW)).toEqual([])
    expect(selectPaymentGateReminders([{ ...base, createdAt: due, ownerId: null }], NOW)).toEqual([])
  })
})
