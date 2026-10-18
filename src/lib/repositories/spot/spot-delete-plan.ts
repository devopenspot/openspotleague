import { and, eq, inArray } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import {
  gameLocationVerifications,
  gameSessions,
  spotChallengeRecords,
  spotWeatherReports,
} from "@/db/schema"

type Db = ReturnType<typeof drizzle>
type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0]
export type SpotDeleteDb = Db | DbTransaction

export interface SpotDeleteSnapshot {
  name: string
  city: string
  slug: string
}

import type { SpotDetachSummary } from "../core/types"

/**
 * Tiered moderation detach for spot hard-deletes. Runs inside the ambient
 * `delete` transaction (see `withRetryAll`), so every statement below is
 * atomic with the final `spots` row delete — a stale OCC guard rolls all
 * of it back.
 *
 * Tiers (each predicate hits an existing `spot_id` index — no N+1):
 * - lobby games: hard-delete, they never started so there is no history
 *   worth preserving (players/rounds/signals cascade from `game_sessions`).
 * - active games: cancel + detach (`cancelled_at = now()`), a running game
 *   cannot keep verifying location against a removed spot.
 * - complete/cancelled games: detach only, history stays readable via the
 *   name/city snapshots and the `spot_removed` marker.
 * - challenge records: snapshot name/slug in place as an audit trail of
 *   which spot the record belonged to (no reader yet); the `SET NULL` FK
 *   fires on the parent delete.
 * - weather reports + location verifications: delete, they are evidence
 *   scoped to the removed spot (parent game rows keep their denormalized
 *   weather/round snapshots).
 *
 * Detached games also get a fresh `updatedAt` so game lists and
 * `updatedAt`-keyed caches reflect the change (game OCC versions on the
 * separate `version` column, which is deliberately left alone to avoid
 * spurious `STALE_VERSION` errors for in-flight clients).
 *
 * Returns a summary for the content-audit metadata and the moderation log
 * line — curators can confirm exactly what a delete detached.
 *
 * Deliberately untouched (DB handles them, no statements needed):
 * - `saved_spots`, `verified_spots`, `spot_weather_verifications`,
 *   `spot_disciplines`, `spot_type_assignments` (`ON DELETE CASCADE`)
 * - `community_spot_submissions.canonical_spot_id` (`ON DELETE SET NULL`)
 *
 * When a new `RESTRICT → spots` FK is added, extend this function instead of
 * working around it at the call site — the route maps any leftover `23503`
 * to 409 as a tripwire.
 */
export async function detachSpotDependents(
  db: SpotDeleteDb,
  spotId: string,
  snapshot: SpotDeleteSnapshot,
): Promise<SpotDetachSummary> {
  const now = new Date()
  const lobbies = await db
    .delete(gameSessions)
    .where(
      and(eq(gameSessions.spotId, spotId), eq(gameSessions.status, "lobby")),
    )
    .returning({ id: gameSessions.id })

  const detachedChallenge = {
    spotId: null,
    spotRemoved: true,
    spotNameSnapshot: snapshot.name,
    spotCitySnapshot: snapshot.city,
    updatedAt: now,
  }
  const cancelledChallenge = await db
    .update(gameSessions)
    .set({
      ...detachedChallenge,
      status: "cancelled",
      cancelledAt: now,
    })
    .where(
      and(
        eq(gameSessions.spotId, spotId),
        eq(gameSessions.mode, "challenge"),
        eq(gameSessions.status, "active"),
      ),
    )
    .returning({ id: gameSessions.id })
  const finishedChallenge = await db
    .update(gameSessions)
    .set(detachedChallenge)
    .where(
      and(
        eq(gameSessions.spotId, spotId),
        eq(gameSessions.mode, "challenge"),
        inArray(gameSessions.status, ["complete", "cancelled"]),
      ),
    )
    .returning({ id: gameSessions.id })

  // Trainings additionally clear their spot-anchored location/schedule
  // columns so the training branch of the spot CHECK keeps passing with a
  // null spot (weather columns are kept — the relaxed weather CHECK permits
  // historic weather behind `spot_removed`).
  const detachedTraining = {
    ...detachedChallenge,
    scheduledStartAt: null,
    timezone: null,
    locationRadiusMeters: null,
    locationMaxAccuracyMeters: null,
    locationVerificationTtlSeconds: null,
  }
  const cancelledTraining = await db
    .update(gameSessions)
    .set({
      ...detachedTraining,
      status: "cancelled",
      cancelledAt: now,
    })
    .where(
      and(
        eq(gameSessions.spotId, spotId),
        eq(gameSessions.mode, "training"),
        eq(gameSessions.status, "active"),
      ),
    )
    .returning({ id: gameSessions.id })
  const finishedTraining = await db
    .update(gameSessions)
    .set(detachedTraining)
    .where(
      and(
        eq(gameSessions.spotId, spotId),
        eq(gameSessions.mode, "training"),
        inArray(gameSessions.status, ["complete", "cancelled"]),
      ),
    )
    .returning({ id: gameSessions.id })

  const records = await db
    .update(spotChallengeRecords)
    .set({
      spotNameSnapshot: snapshot.name,
      spotSlugSnapshot: snapshot.slug,
    })
    .where(eq(spotChallengeRecords.spotId, spotId))
    .returning({ id: spotChallengeRecords.id })

  const reports = await db
    .delete(spotWeatherReports)
    .where(eq(spotWeatherReports.spotId, spotId))
    .returning({ id: spotWeatherReports.id })
  const verifications = await db
    .delete(gameLocationVerifications)
    .where(eq(gameLocationVerifications.spotId, spotId))
    .returning({ id: gameLocationVerifications.id })

  return {
    lobbiesDeleted: lobbies.length,
    challengesDetached: cancelledChallenge.length + finishedChallenge.length,
    trainingsDetached: cancelledTraining.length + finishedTraining.length,
    challengeRecordsSnapshotted: records.length,
    weatherReportsDeleted: reports.length,
    locationVerificationsDeleted: verifications.length,
  }
}
