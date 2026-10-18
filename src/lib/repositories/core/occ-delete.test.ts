import { beforeEach, describe, expect, it, vi } from "vitest"
import { StaleRecordError } from "./errors"
import { deleteWithOccAudit } from "./occ-delete"

const recordContentAuditMock = vi.fn()

vi.mock("../admin/content-audit", () => ({
  recordContentAudit: (...args: unknown[]) => recordContentAuditMock(...args),
}))

function makeDb(deleteResult: Array<{ id: string }>, existingRow?: { id: string }) {
  return {
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(deleteResult),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(existingRow ? [existingRow] : []),
        }),
      }),
    }),
  } as unknown as Parameters<typeof deleteWithOccAudit>[0]["db"]
}

const baseOptions = {
  table: { id: {}, updatedAt: {} } as unknown as Parameters<
    typeof deleteWithOccAudit
  >[0]["table"],
  id: "spot-1",
  entityType: "spot" as const,
  before: { id: "spot-1" },
  notFoundMessage: "Spot not found: spot-1",
}

describe("deleteWithOccAudit", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("deletes, writes the audit row, and reports success", async () => {
    const db = makeDb([{ id: "spot-1" }])
    await deleteWithOccAudit({ ...baseOptions, db, actorId: "admin-1" })
    expect(recordContentAuditMock).toHaveBeenCalledTimes(1)
    expect(recordContentAuditMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actorId: "admin-1",
        entityType: "spot",
        entityId: "spot-1",
        action: "delete",
        before: { id: "spot-1" },
        after: null,
      }),
    )
  })

  it("forwards metadata to the audit row when provided", async () => {
    const db = makeDb([{ id: "spot-1" }])
    await deleteWithOccAudit({
      ...baseOptions,
      db,
      metadata: { moderation: "hard_delete" },
    })
    expect(recordContentAuditMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ metadata: { moderation: "hard_delete" } }),
    )
  })

  it("throws StaleRecordError when the guard mismatched but the row exists", async () => {
    const db = makeDb([], { id: "spot-1" })
    await expect(
      deleteWithOccAudit({
        ...baseOptions,
        db,
        expectedDate: new Date("2026-01-01T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(StaleRecordError)
    expect(recordContentAuditMock).not.toHaveBeenCalled()
  })

  it("treats an absent row as not-found even under an OCC guard", async () => {
    const db = makeDb([], undefined)
    await expect(
      deleteWithOccAudit({
        ...baseOptions,
        db,
        expectedDate: new Date("2026-01-01T00:00:00Z"),
      }),
    ).rejects.toThrow("Spot not found: spot-1")
    expect(recordContentAuditMock).not.toHaveBeenCalled()
  })

  it("treats an unconditional miss as not-found without the existence probe", async () => {
    const selectSpy = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "spot-1" }]),
        }),
      }),
    }))
    const db = {
      delete: () => ({
        where: () => ({ returning: () => Promise.resolve([]) }),
      }),
      select: selectSpy,
    } as unknown as Parameters<typeof deleteWithOccAudit>[0]["db"]
    await expect(deleteWithOccAudit({ ...baseOptions, db })).rejects.toThrow(
      "Spot not found: spot-1",
    )
    expect(selectSpy).not.toHaveBeenCalled()
    expect(recordContentAuditMock).not.toHaveBeenCalled()
  })
})
