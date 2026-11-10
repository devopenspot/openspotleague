import { beforeEach, describe, expect, it, vi } from "vitest"

const delivery = vi.hoisted(() => ({
  configured: true,
  queueImmediateEmails: vi.fn(),
}))

vi.mock("@/lib/notifications/delivery", () => ({
  isEmailDeliveryConfigured: () => delivery.configured,
  queueImmediateEmails: delivery.queueImmediateEmails,
}))
vi.mock("@/lib/db/client", () => ({
  getDbClient: vi.fn(),
  withDbRead: vi.fn(),
  withDbWrite: vi.fn(),
}))

import { createNotifications } from "./service"

type Row = { type: string; emailStatus: string | null; emailUrgency: string | null }

/** A transaction stand-in that records the inserted rows and returns ids. */
function fakeTx() {
  const inserted: Row[] = []
  const tx = {
    insert: () => ({
      values: (rows: Row[]) => {
        inserted.push(...rows)
        return {
          onConflictDoNothing: () => ({
            returning: async () =>
              rows.map((row, index) => ({ id: `id-${inserted.length - rows.length + index}`, urgency: row.emailUrgency })),
          }),
        }
      },
    }),
  }
  return { tx: tx as unknown as Parameters<typeof createNotifications>[0], inserted }
}

const drafts = [
  { userId: "u1", type: "league_event_cancelled" as const },
  { userId: "u1", type: "league_schedule_published" as const },
  { userId: "u1", type: "league_member_removed" as const },
]

describe("createNotifications email outbox", () => {
  beforeEach(() => {
    delivery.queueImmediateEmails.mockClear()
  })

  it("marks email-eligible rows pending and hands over the immediate ones", async () => {
    delivery.configured = true
    const { tx, inserted } = fakeTx()
    await createNotifications(tx, drafts)
    expect(inserted.map((row) => [row.emailStatus, row.emailUrgency])).toEqual([
      ["pending", "immediate"],
      ["pending", "digest"],
      [null, null],
    ])
    expect(delivery.queueImmediateEmails).toHaveBeenCalledWith(["id-0"])
  })

  it("keeps every row in-app only while email delivery is off", async () => {
    delivery.configured = false
    const { tx, inserted } = fakeTx()
    await createNotifications(tx, drafts)
    expect(inserted.every((row) => row.emailStatus === null && row.emailUrgency === null)).toBe(true)
    expect(delivery.queueImmediateEmails).toHaveBeenCalledWith([])
  })
})
