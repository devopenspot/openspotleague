import { beforeEach, describe, expect, it, vi } from "vitest"
import { DrizzleTaxonomyRepository } from "./drizzle-taxonomy-repository"

const listCurrentTrickCatalogsMock = vi.fn()
const saveCanonicalTrickMock = vi.fn()
const deleteCanonicalTrickMock = vi.fn()

vi.mock("./trick-catalog-store", () => ({
  listCurrentTrickCatalogs: (...args: unknown[]) => listCurrentTrickCatalogsMock(...args),
  saveCanonicalTrick: (...args: unknown[]) => saveCanonicalTrickMock(...args),
  deleteCanonicalTrick: (...args: unknown[]) => deleteCanonicalTrickMock(...args),
}))

describe("DrizzleTaxonomyRepository trick persistence", () => {
  const db = {} as ConstructorParameters<typeof DrizzleTaxonomyRepository>[0]
  const repository = new DrizzleTaxonomyRepository(db)
  const trick = {
    sourceId: "boardslide",
    name: "Boardslide",
    description: "Slide the board across the rail.",
    level: 1 as const,
    compatibleSpotTypes: ["rails"], categories: [],
  }

  beforeEach(() => {
    vi.resetAllMocks()
    listCurrentTrickCatalogsMock.mockResolvedValue([])
    saveCanonicalTrickMock.mockResolvedValue(trick)
    deleteCanonicalTrickMock.mockResolvedValue(undefined)
  })

  it("reads current tricks from the canonical store", async () => {
    await expect(repository.listCurrentTrickCatalogs()).resolves.toEqual([])
    expect(listCurrentTrickCatalogsMock).toHaveBeenCalledWith(db)
  })

  it("saves one canonical trick without publishing a whole catalog", async () => {
    await expect(repository.saveTrick("skateboard", trick)).resolves.toEqual(trick)
    expect(saveCanonicalTrickMock).toHaveBeenCalledWith(db, "skateboard", trick)
  })

  it("deletes one canonical trick", async () => {
    await repository.deleteTrick("skateboard", "boardslide")
    expect(deleteCanonicalTrickMock).toHaveBeenCalledWith(db, "skateboard", "boardslide")
  })

  it("blocks deleting a sport that is still referenced in spots.sports", async () => {
    const selectResults = [
      [{ slug: "skateboard", name: "Skateboard" }],
      [{ id: "spot-1" }],
    ]
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(selectResults.shift() ?? []),
          }),
        }),
      }),
      delete: vi.fn(),
    } as unknown as ConstructorParameters<typeof DrizzleTaxonomyRepository>[0]

    const repo = new DrizzleTaxonomyRepository(mockDb)
    await expect(repo.deleteSport("skateboard")).rejects.toThrow(
      "Sport is still in use: skateboard",
    )
    expect(mockDb.delete).not.toHaveBeenCalled()
  })
})
