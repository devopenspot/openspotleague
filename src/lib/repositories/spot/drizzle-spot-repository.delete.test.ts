import { beforeEach, describe, expect, it, vi } from "vitest"
import { DrizzleSpotRepository } from "./drizzle-spot-repository"

const detachSpotDependentsMock = vi.fn()
const deleteWithOccAuditMock = vi.fn()

vi.mock("./spot-delete-plan", () => ({
  detachSpotDependents: (...args: unknown[]) =>
    detachSpotDependentsMock(...args),
}))

vi.mock("../core/occ-delete", () => ({
  deleteWithOccAudit: (...args: unknown[]) =>
    deleteWithOccAuditMock(...args),
}))

vi.mock("../admin/content-audit", () => ({
  recordContentAudit: vi.fn(),
  toAuditJson: (value: unknown) => value,
}))

const spotRow = {
  id: "spot-1",
  slug: "hubba-hideout",
  name: "HUBBA HIDEOUT",
  city: "San Francisco",
  imageUrl: "spots/spot-1/master.webp",
  origin: "community",
  adminHidden: false,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
}

function makeDb(row: unknown) {
  // auditSnapshot issues three selects: the spot row (ending in `.limit(1)`)
  // plus disciplines and types (ending in `.where(...)`).
  const queue: unknown[] = row ? [[row], [], []] : [[]]
  return {
    select: () => ({
      from: () => ({
        where: () => {
          const pending = Promise.resolve(queue.shift())
          return Object.assign(pending, { limit: () => pending })
        },
      }),
    }),
  }
}

describe("DrizzleSpotRepository.delete", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    detachSpotDependentsMock.mockResolvedValue({ lobbiesDeleted: 1 })
  })

  it("hard-deletes community spots via detach + OCC instead of soft-hiding", async () => {
    const db = makeDb(spotRow)
    const repo = new DrizzleSpotRepository(
      db as unknown as ConstructorParameters<typeof DrizzleSpotRepository>[0],
    )
    const result = await repo.delete(
      "spot-1",
      "2025-01-01T00:00:00.000Z",
      "admin-1",
    )
    expect(detachSpotDependentsMock).toHaveBeenCalledTimes(1)
    expect(detachSpotDependentsMock).toHaveBeenCalledWith(db, "spot-1", {
      name: "HUBBA HIDEOUT",
      city: "San Francisco",
      slug: "hubba-hideout",
    })
    expect(deleteWithOccAuditMock).toHaveBeenCalledTimes(1)
    expect(deleteWithOccAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "spot-1",
        entityType: "spot",
        actorId: "admin-1",
        notFoundMessage: "Spot not found: spot-1",
        metadata: {
          moderation: "hard_delete",
          detach: { lobbiesDeleted: 1 },
        },
      }),
    )
    expect(result).toEqual({
      imagePath: "spots/spot-1/master.webp",
      detachSummary: { lobbiesDeleted: 1 },
    })
  })

  it("throws not-found without touching dependents when the snapshot is missing", async () => {
    const db = makeDb(null)
    const repo = new DrizzleSpotRepository(
      db as unknown as ConstructorParameters<typeof DrizzleSpotRepository>[0],
    )
    await expect(repo.delete("missing")).rejects.toThrow(
      "Spot not found: missing",
    )
    expect(detachSpotDependentsMock).not.toHaveBeenCalled()
    expect(deleteWithOccAuditMock).not.toHaveBeenCalled()
  })

  it("rejects an invalid concurrency token before detaching anything", async () => {
    const db = makeDb(spotRow)
    const repo = new DrizzleSpotRepository(
      db as unknown as ConstructorParameters<typeof DrizzleSpotRepository>[0],
    )
    await expect(repo.delete("spot-1", "not-a-date")).rejects.toThrow()
    expect(detachSpotDependentsMock).not.toHaveBeenCalled()
    expect(deleteWithOccAuditMock).not.toHaveBeenCalled()
  })
})
