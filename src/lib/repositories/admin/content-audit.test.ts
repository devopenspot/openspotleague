import { describe, expect, it, vi } from "vitest"
import { recordContentAudit, toAuditJson } from "./content-audit"

describe("content audit persistence", () => {
  it("serializes database values without losing nested snapshots", () => {
    expect(toAuditJson({ changedAt: new Date("2026-01-01T00:00:00.000Z") })).toEqual({
      changedAt: "2026-01-01T00:00:00.000Z",
    })
  })

  it("writes an audit entry through the current transaction", async () => {
    const values = vi.fn().mockResolvedValue([])
    const insert = vi.fn().mockReturnValue({ values })
    const db = { insert } as unknown as Parameters<typeof recordContentAudit>[0]

    await recordContentAudit(db, {
      actorId: "user-1",
      entityType: "spot",
      entityId: "spot-1",
      action: "update",
      before: { name: "OLD" },
      after: { name: "NEW" },
      metadata: { source: "admin" },
    })

    expect(insert).toHaveBeenCalledOnce()
    expect(values).toHaveBeenCalledWith({
      actorId: "user-1",
      entityType: "spot",
      entityId: "spot-1",
      disciplineSlug: null,
      action: "update",
      before: { name: "OLD" },
      after: { name: "NEW" },
      metadata: { source: "admin" },
    })
  })
})
