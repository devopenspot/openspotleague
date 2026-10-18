import { beforeEach, describe, expect, it, vi } from "vitest"
import type { drizzle } from "drizzle-orm/postgres-js"
import type { JoinedSpotRow } from "./spot-query"
import { DrizzleVerifiedSpotsRepository } from "./drizzle-verified-spots-repository"

interface HeadRow {
  userId: string
  spotId: string
  createdAt: Date
}

function headRow(spotId: string, iso: string): HeadRow {
  return {
    userId: "user-1",
    spotId,
    createdAt: new Date(iso),
  }
}

function joinedRow(id: string, name: string): JoinedSpotRow {
  return {
    id,
    slug: `slug-${id}`,
    name,
    city: "Bogota",
    citySlug: "bogota",
    address: "calle 1",
    types: [],
    sports: [],
    imageUrl: null,
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 1,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat: 4.6, lon: -74.06 },
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  } as unknown as JoinedSpotRow
}

type Capture = { limit: number[]; joinedIds: string[][] }

function makeDb(
  headRows: HeadRow[],
  capture: Capture,
) {
  const head = {
    where: () => ({
      orderBy: () => ({
        limit: (n: number) => {
          capture.limit.push(n)
          return Promise.resolve(
            headRows as unknown as readonly Record<string, unknown>[],
          )
        },
      }),
    }),
  }
  return {
    select: () => ({ from: () => head }),
  } as unknown as ReturnType<typeof drizzle>
}

vi.mock("./spot-query", async () => {
  return {
    joinedSpotSelect: () => ({
      where: (_condition: unknown) => Promise.resolve(joinedRef.rows),
    }),
    rowToSpot: (row: { id: string; name: string }) => ({
      id: row.id,
      name: row.name,
    }),
  }
})

const joinedRef: { rows: JoinedSpotRow[] } = { rows: [] }

beforeEach(() => {
  joinedRef.rows = []
})

describe("DrizzleVerifiedSpotsRepository.listWithSpots", () => {
  it("joins full spot entities in link order, dropping rows whose spot vanished", async () => {
    const capture: Capture = { limit: [], joinedIds: [] }
    joinedRef.rows = [joinedRow("a", "Spot A"), joinedRow("b", "Spot B")]
    const repository = new DrizzleVerifiedSpotsRepository(
      makeDb(
        [
          headRow("a", "2026-01-02T00:00:00Z"),
          headRow("gone", "2026-01-03T00:00:00Z"),
          headRow("b", "2026-01-04T00:00:00Z"),
        ],
        capture,
      ),
    )

    void capture
    const result = await repository.listWithSpots("user-1")

    expect(result.items.map((i) => i.spotId)).toEqual(["a", "b"])
    expect(result.items[0]?.spot).toMatchObject({ id: "a", name: "Spot A" })
    expect(result.nextCursor).toBeNull()
  })

  it("returns an empty page without running the join when the user has no verifications", async () => {
    const repository = new DrizzleVerifiedSpotsRepository(
      makeDb([], { limit: [], joinedIds: [] }),
    )
    const result = await repository.listWithSpots("user-1")
    expect(result).toEqual({ items: [], nextCursor: null })
  })

  it("pages at the requested limit and cursor-paginates by created_at", async () => {
    const capture: Capture = { limit: [], joinedIds: [] }
    joinedRef.rows = [joinedRow("a", "Spot A")]
    const repository = new DrizzleVerifiedSpotsRepository(
      makeDb(
        [
          headRow("a", "2026-01-02T00:00:00Z"),
          headRow("b", "2026-01-03T00:00:00Z"),
        ],
        capture,
      ),
    )

    const result = await repository.listWithSpots("user-1", { limit: 1 })

    expect(capture.limit).toEqual([2])
    expect(result.items.map((i) => i.spotId)).toEqual(["a"])
    expect(result.nextCursor).toBe("2026-01-02T00:00:00.000Z")
  })
})
