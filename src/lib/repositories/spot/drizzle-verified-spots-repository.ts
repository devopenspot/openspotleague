import { and, count, desc, eq, inArray, sql } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import { spots, verifiedSpots } from "@/db/schema"
import { joinedSpotSelect, rowToSpot } from "./spot-query"
import type { VerifiedSpotWithDetails } from "@/types/saved-spot"
import type {
  VerifiedSpotsListResult,
  VerifiedSpotsRepository,
  VerifiedSpotsWithDetailsListResult,
} from "./verified-spots-repository"

export class DrizzleVerifiedSpotsRepository implements VerifiedSpotsRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async isVerified(userId: string, spotId: string): Promise<boolean> {
    // Composite PK lookup with `count()` + `LIMIT 1` is the cheapest
    // way to coerce the result to a boolean — a `select { … } limit 1`
    // would still hydrate the row. The trigger keeps the denormalized
    // count in `spots.verification_count`, but `isVerified` is the
    // *current-user* check, which the counter can't answer.
    const [row] = await this.db
      .select({ x: count() })
      .from(verifiedSpots)
      .where(
        and(
          eq(verifiedSpots.userId, userId),
          eq(verifiedSpots.spotId, spotId),
        ),
      )
      .limit(1)
    return Number(row?.x ?? 0) > 0
  }

  async verify(userId: string, spotId: string): Promise<number> {
    // The composite PK guarantees uniqueness; `ON CONFLICT DO NOTHING`
    // makes the toggle idempotent (a re-verify is a no-op rather than
    // a constraint violation). The trigger bumps
    // `spots.verification_count` only on a real insert.
    await this.db
      .insert(verifiedSpots)
      .values({ userId, spotId })
      .onConflictDoNothing()
    // Re-read the count after the trigger. We do this in the same
    // method (not a separate `countForSpot` call) so the API caller
    // gets the new value in a single round-trip semantically — even
    // though the driver does two queries, the trigger is the source
    // of truth and a transaction is unnecessary.
    return this.countForSpot(spotId)
  }

  async unverify(userId: string, spotId: string): Promise<number> {
    await this.db
      .delete(verifiedSpots)
      .where(
        and(
          eq(verifiedSpots.userId, userId),
          eq(verifiedSpots.spotId, spotId),
        ),
      )
    return this.countForSpot(spotId)
  }

  async countForSpot(spotId: string): Promise<number> {
    const [row] = await this.db
      .select({ x: spots.verificationCount })
      .from(spots)
      .where(eq(spots.id, spotId))
      .limit(1)
    return row?.x ?? 0
  }

  async list(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<VerifiedSpotsListResult> {
    const limit = opts?.limit ?? 200
    const conditions = [eq(verifiedSpots.userId, userId)]
    if (opts?.cursor) {
      conditions.push(sql`${verifiedSpots.createdAt} < ${opts.cursor}`)
    }
    const rows = await this.db
      .select({
        userId: verifiedSpots.userId,
        spotId: verifiedSpots.spotId,
        createdAt: verifiedSpots.createdAt,
      })
      .from(verifiedSpots)
      .where(and(...conditions))
      .orderBy(desc(verifiedSpots.createdAt))
      .limit(limit + 1)

    const slice = rows.slice(0, limit)
    const nextCursor =
      rows.length > limit
        ? (slice[slice.length - 1]?.createdAt.toISOString() ?? null)
        : null
    return {
      items: slice.map((r) => ({
        userId: r.userId,
        spotId: r.spotId,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    }
  }

  async listWithSpots(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<VerifiedSpotsWithDetailsListResult> {
    // Two-query join (head rows, then joined spots by id) mirrors
    // `DrizzleSavedSpotsRepository.list` — the head query paged by
    // `created_at desc`, the join hydrated via `joinedSpotSelect`.
    // Verified rows whose spot row vanished (deleted spot) are
    // dropped, same as the saved list.
    const limit = opts?.limit ?? 200
    const conditions = [eq(verifiedSpots.userId, userId)]
    if (opts?.cursor) {
      conditions.push(sql`${verifiedSpots.createdAt} < ${opts.cursor}`)
    }
    const rows = await this.db
      .select({
        userId: verifiedSpots.userId,
        spotId: verifiedSpots.spotId,
        createdAt: verifiedSpots.createdAt,
      })
      .from(verifiedSpots)
      .where(and(...conditions))
      .orderBy(desc(verifiedSpots.createdAt))
      .limit(limit + 1)

    const slice = rows.slice(0, limit)
    const nextCursor =
      rows.length > limit
        ? (slice[slice.length - 1]?.createdAt.toISOString() ?? null)
        : null
    if (slice.length === 0) {
      return { items: [], nextCursor }
    }

    const spotIds = slice.map((r) => r.spotId)
    const joined = await joinedSpotSelect(this.db).where(
      inArray(spots.id, spotIds),
    )
    const spotById = new Map(joined.map((r) => [r.id, rowToSpot(r)]))

    const items: VerifiedSpotWithDetails[] = slice.flatMap((r) => {
      const spot = spotById.get(r.spotId)
      if (!spot) return []
      return [
        {
          userId: r.userId,
          spotId: r.spotId,
          createdAt: r.createdAt.toISOString(),
          spot,
        },
      ]
    })
    return { items, nextCursor }
  }
}
