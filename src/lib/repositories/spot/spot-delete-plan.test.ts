import { describe, expect, it } from "vitest"
import {
  gameLocationVerifications,
  gameSessions,
  spotChallengeRecords,
  spotWeatherReports,
} from "@/db/schema"
import { detachSpotDependents, type SpotDeleteDb } from "./spot-delete-plan"

interface RecordedCall {
  op: "delete" | "update"
  table: unknown
  values?: Record<string, unknown>
}

function makeDb() {
  const calls: RecordedCall[] = []
  const db = {
    delete: (table: unknown) => ({
      where: () => ({
        returning: () => {
          calls.push({ op: "delete", table })
          return Promise.resolve([{ id: "row-1" }])
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            calls.push({ op: "update", table, values })
            return Promise.resolve([{ id: "row-1" }])
          },
        }),
      }),
    }),
  }
  return { db, calls }
}

const snapshot = { name: "HUBBA HIDEOUT", city: "San Francisco", slug: "hubba-hideout" }

describe("detachSpotDependents", () => {
  it("runs lobby-delete, detach-updates, snapshot, and evidence deletes", async () => {
    const { db, calls } = makeDb()
    await detachSpotDependents(db as unknown as SpotDeleteDb, "spot-1", snapshot)
    // Statement order is irrelevant (predicates are disjoint), so assert
    // the multiset of statements — a harmless reordering must not fail this.
    expect(calls).toHaveLength(8)
    expect(
      calls.filter((call) => call.op === "delete").map((call) => call.table),
    ).toEqual(
      expect.arrayContaining([
        gameSessions,
        spotWeatherReports,
        gameLocationVerifications,
      ]),
    )
    expect(calls.filter((call) => call.op === "delete")).toHaveLength(3)
    expect(
      calls.filter(
        (call) => call.op === "update" && call.table === gameSessions,
      ),
    ).toHaveLength(4)
    expect(
      calls.some(
        (call) => call.op === "update" && call.table === spotChallengeRecords,
      ),
    ).toBe(true)
  })

  it("cancels active games and detaches finished ones with snapshots", async () => {
    const { db, calls } = makeDb()
    await detachSpotDependents(db as unknown as SpotDeleteDb, "spot-1", snapshot)
    const gameUpdates = calls.filter(
      (call) => call.op === "update" && call.table === gameSessions,
    )
    expect(gameUpdates).toHaveLength(4)
    for (const update of gameUpdates) {
      expect(update.values).toMatchObject({
        spotId: null,
        spotRemoved: true,
        spotNameSnapshot: snapshot.name,
        spotCitySnapshot: snapshot.city,
        updatedAt: expect.any(Date),
      })
    }
    const cancelled = gameUpdates.filter(
      (update) => update.values?.status === "cancelled",
    )
    // One cancelled detach per mode (challenge + training); finished games
    // keep their status and only lose the spot link.
    expect(cancelled).toHaveLength(2)
    expect(cancelled[0]?.values?.cancelledAt).toBeInstanceOf(Date)
  })

  it("clears spot-anchored location columns for trainings but keeps challenge history intact", async () => {
    const { db, calls } = makeDb()
    await detachSpotDependents(db as unknown as SpotDeleteDb, "spot-1", snapshot)
    const gameUpdates = calls.filter(
      (call) => call.op === "update" && call.table === gameSessions,
    )
    const [challengeActive, challengeDone, trainingActive, trainingDone] =
      gameUpdates.map((update) => update.values ?? {})
    for (const values of [challengeActive, challengeDone]) {
      expect(values).not.toHaveProperty("scheduledStartAt")
      expect(values).not.toHaveProperty("locationRadiusMeters")
    }
    for (const values of [trainingActive, trainingDone]) {
      expect(values).toMatchObject({
        scheduledStartAt: null,
        timezone: null,
        locationRadiusMeters: null,
        locationMaxAccuracyMeters: null,
        locationVerificationTtlSeconds: null,
      })
      // Historic training weather is preserved (relaxed weather CHECK).
      expect(values).not.toHaveProperty("weatherForecastIcon")
    }
  })

  it("snapshots challenge records instead of deleting them", async () => {
    const { db, calls } = makeDb()
    await detachSpotDependents(db as unknown as SpotDeleteDb, "spot-1", snapshot)
    const recordUpdate = calls.find(
      (call) => call.op === "update" && call.table === spotChallengeRecords,
    )
    expect(recordUpdate?.values).toEqual({
      spotNameSnapshot: snapshot.name,
      spotSlugSnapshot: snapshot.slug,
    })
    expect(
      calls.some(
        (call) => call.op === "delete" && call.table === spotChallengeRecords,
      ),
    ).toBe(false)
  })

  it("returns per-tier counts for the audit metadata and log line", async () => {
    const { db } = makeDb()
    const summary = await detachSpotDependents(
      db as unknown as SpotDeleteDb,
      "spot-1",
      snapshot,
    )
    expect(summary).toEqual({
      lobbiesDeleted: 1,
      challengesDetached: 2,
      trainingsDetached: 2,
      challengeRecordsSnapshotted: 1,
      weatherReportsDeleted: 1,
      locationVerificationsDeleted: 1,
    })
  })
})
