import { and, eq, sql } from "drizzle-orm"
import type { PgDatabase } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"

import { communitySpotSubmissions, spots } from "@/db/schema"
import {
  COMMUNITY_PROMOTION_THRESHOLD,
  COMMUNITY_RADIUS_METERS,
} from "@/lib/config/constants"

/**
 * Any Drizzle handle: the repository's db or a service transaction. Callers
 * that already hold a game transaction pass it so the promotion commits (or
 * rolls back) with the game write.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts schema-typed and untyped handles alike
export type CommunityDb = PgDatabase<PostgresJsQueryResultHKT, any, any>

export type CommunityPromotionResult = {
  distinctCount: number
  promoted: boolean
  /** Ids of spots whose visibility flipped to public (for cache invalidation). */
  promotedSpotIds: string[]
}

/**
 * Community rule: a personal spot becomes public once
 * `COMMUNITY_PROMOTION_THRESHOLD` distinct riders have vouched for a place
 * within `COMMUNITY_RADIUS_METERS` — by submitting it, or by verifying their
 * location there in a battle. Serialized per `lockKey` so concurrent
 * submissions never double-promote.
 */
export async function promoteCommunitySpotsNear(
  db: CommunityDb,
  input: { lat: number; lon: number; lockKey: string; spotId: string },
): Promise<CommunityPromotionResult> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${input.lockKey}))`)

  const point = sql`ST_SetSRID(ST_MakePoint(${input.lon}, ${input.lat}), 4326)::geography`
  const countRows = await db.execute<{ cnt: string }>(
    sql`select count(distinct css.user_id)::int as cnt from ${communitySpotSubmissions} css join ${spots} s on s.id = css.canonical_spot_id where ST_DWithin(css.location, ${point}, ${COMMUNITY_RADIUS_METERS}) and s.admin_hidden = false`,
  )
  const distinctCount = Number(countRows[0]?.cnt ?? 0)

  if (distinctCount >= COMMUNITY_PROMOTION_THRESHOLD) {
    const promotedRows = await db.execute<{ id: string }>(sql`
      update ${spots}
      set visibility = 'public',
          origin = 'community',
          community_submission_count = ${distinctCount},
          updated_at = now()
      where id in (
        select css.canonical_spot_id from ${communitySpotSubmissions} css join ${spots} s on s.id = css.canonical_spot_id
        where ST_DWithin(css.location, ${point}, ${COMMUNITY_RADIUS_METERS})
          and css.canonical_spot_id is not null
          and s.admin_hidden = false
      )
        and visibility = 'personal'
      returning id
    `)
    return {
      distinctCount,
      promoted: true,
      promotedSpotIds: [...promotedRows].map((row) => row.id),
    }
  }

  await db
    .update(spots)
    .set({ communitySubmissionCount: distinctCount })
    .where(eq(spots.id, input.spotId))
  return { distinctCount, promoted: false, promotedSpotIds: [] }
}

/**
 * Records that `userId` vouched for an existing personal spot by verifying
 * their location there in a battle, then applies the community rule.
 * Idempotent per rider and spot. A creator vouching for their own spot never
 * counts twice: they already hold its original submission row.
 */
export async function confirmCommunitySpot(
  db: CommunityDb,
  input: { spotId: string; userId: string },
): Promise<CommunityPromotionResult | null> {
  const [spot] = await db
    .select({
      id: spots.id,
      location: spots.location,
      visibility: spots.visibility,
      adminHidden: spots.adminHidden,
    })
    .from(spots)
    .where(eq(spots.id, input.spotId))
    .limit(1)
  if (!spot || spot.visibility !== "personal" || spot.adminHidden) return null

  const submissionHash = `confirm:${spot.id}`
  const existing = await db
    .select({ id: communitySpotSubmissions.id })
    .from(communitySpotSubmissions)
    .where(
      and(
        eq(communitySpotSubmissions.userId, input.userId),
        eq(communitySpotSubmissions.canonicalSpotId, spot.id),
      ),
    )
    .limit(1)
  if (existing.length === 0) {
    await db
      .insert(communitySpotSubmissions)
      .values({
        userId: input.userId,
        canonicalSpotId: spot.id,
        location: spot.location,
        submissionHash,
      })
      .onConflictDoNothing()
  }

  return promoteCommunitySpotsNear(db, {
    lat: spot.location.lat,
    lon: spot.location.lon,
    lockKey: `community-spot:${spot.id}`,
    spotId: spot.id,
  })
}
