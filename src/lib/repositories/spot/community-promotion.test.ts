import { describe, expect, it, vi } from "vitest"

import {
  confirmCommunitySpot,
  type CommunityDb,
} from "./community-promotion"

/** Minimal scripted Drizzle stand-in: each select/execute pops a result. */
function fakeDb(script: { selects: unknown[][]; executes: unknown[][] }) {
  const inserted: unknown[] = []
  const updated: unknown[] = []
  const selects = [...script.selects]
  const executes = [...script.executes]
  const chain = (result: unknown[]) => {
    const node: Record<string, unknown> = {}
    for (const key of ["from", "where"]) node[key] = () => node
    node.limit = async () => result
    return node
  }
  const db = {
    select: () => chain(selects.shift() ?? []),
    insert: () => ({
      values: (value: unknown) => {
        inserted.push(value)
        return { onConflictDoNothing: async () => undefined }
      },
    }),
    update: () => ({
      set: (value: unknown) => {
        updated.push(value)
        return { where: async () => undefined }
      },
    }),
    execute: vi.fn(async () => executes.shift() ?? []),
  }
  return { db: db as unknown as CommunityDb, inserted, updated, execute: db.execute }
}

const personalSpot = {
  id: "spot-1",
  location: { lat: 40.4, lon: -3.7 },
  visibility: "personal",
  adminHidden: false,
}

describe("confirmCommunitySpot", () => {
  it("ignores spots that are already public", async () => {
    const { db, inserted, execute } = fakeDb({
      selects: [[{ ...personalSpot, visibility: "public" }]],
      executes: [],
    })
    expect(await confirmCommunitySpot(db, { spotId: "spot-1", userId: "rider-2" })).toBeNull()
    expect(inserted).toHaveLength(0)
    expect(execute).not.toHaveBeenCalled()
  })

  it("promotes the spot when a second rider checks in", async () => {
    const { db, inserted } = fakeDb({
      selects: [[personalSpot], []],
      // advisory lock, distinct count, promotion update
      executes: [[], [{ cnt: "2" }], [{ id: "spot-1" }]],
    })
    const result = await confirmCommunitySpot(db, { spotId: "spot-1", userId: "rider-2" })
    expect(inserted).toEqual([
      expect.objectContaining({ userId: "rider-2", canonicalSpotId: "spot-1" }),
    ])
    expect(result).toEqual({ distinctCount: 2, promoted: true, promotedSpotIds: ["spot-1"] })
  })

  it("does not double count the creator and keeps the spot personal", async () => {
    const { db, inserted, updated } = fakeDb({
      selects: [[personalSpot], [{ id: "existing-submission" }]],
      executes: [[], [{ cnt: "1" }]],
    })
    const result = await confirmCommunitySpot(db, { spotId: "spot-1", userId: "creator" })
    expect(inserted).toHaveLength(0)
    expect(updated).toEqual([{ communitySubmissionCount: 1 }])
    expect(result).toEqual({ distinctCount: 1, promoted: false, promotedSpotIds: [] })
  })
})
