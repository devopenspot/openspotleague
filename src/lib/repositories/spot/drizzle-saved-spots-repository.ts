import { and, count, desc, eq, inArray, sql } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import { savedSpots, spots } from "@/db/schema"
import type { SavedSpotWithDetails } from "@/types/saved-spot"
import type {
  SavedSpotHeadsListResult,
  SavedSpotsListResult,
  SavedSpotsRepository,
} from "./saved-spots-repository"
import {
  joinedSpotSelect,
  rowToSpot,
} from "./spot-query"

export class DrizzleSavedSpotsRepository implements SavedSpotsRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async listHeads(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<SavedSpotHeadsListResult> {
    const limit = opts?.limit ?? 200
    const conditions = [eq(savedSpots.userId, userId)]
    if (opts?.cursor) {
      conditions.push(sql`${savedSpots.createdAt} < ${opts.cursor}`)
    }
    const rows = await this.db
      .select({
        userId: savedSpots.userId,
        spotId: savedSpots.spotId,
        createdAt: savedSpots.createdAt,
      })
      .from(savedSpots)
      .where(and(...conditions))
      .orderBy(desc(savedSpots.createdAt))
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

  async list(
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<SavedSpotsListResult> {
    const limit = opts?.limit ?? 50
    const conditions = [eq(savedSpots.userId, userId)]
    if (opts?.cursor) {
      conditions.push(sql`${savedSpots.createdAt} < ${opts.cursor}`)
    }
    const rows = await this.db
      .select({ ss: savedSpots })
      .from(savedSpots)
      .where(and(...conditions))
      .orderBy(desc(savedSpots.createdAt))
      .limit(limit + 1)

    const slice = rows.slice(0, limit)
    const spotIds = slice.map((r) => r.ss.spotId)
    if (spotIds.length === 0) {
      return { items: [], nextCursor: null }
    }

    const joined = await joinedSpotSelect(this.db).where(
      inArray(spots.id, spotIds),
    )
    const joinedById = new Map(
      joined.map((r) => [r.id, r]),
    )

    const items: SavedSpotWithDetails[] = slice
      .map((r) => {
        const joinedRow = joinedById.get(r.ss.spotId)
        if (!joinedRow) return null
        return {
          userId: r.ss.userId,
          spotId: r.ss.spotId,
          createdAt: r.ss.createdAt.toISOString(),
          spot: rowToSpot(joinedRow),
        }
      })
      .filter((x): x is SavedSpotWithDetails => x !== null)

    const nextCursor =
      rows.length > limit
        ? (items[items.length - 1]?.createdAt ?? null)
        : null
    return { items, nextCursor }
  }

  async isSaved(userId: string, spotId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ x: count() })
      .from(savedSpots)
      .where(and(eq(savedSpots.userId, userId), eq(savedSpots.spotId, spotId)))
      .limit(1)
    return Number(row?.x ?? 0) > 0
  }

  async save(userId: string, spotId: string): Promise<void> {
    await this.db
      .insert(savedSpots)
      .values({ userId, spotId })
      .onConflictDoNothing()
  }

  async unsave(userId: string, spotId: string): Promise<void> {
    await this.db
      .delete(savedSpots)
      .where(
        and(eq(savedSpots.userId, userId), eq(savedSpots.spotId, spotId)),
      )
  }

  async countForSpot(spotId: string): Promise<number> {
    const [row] = await this.db
      .select({ x: count() })
      .from(savedSpots)
      .where(eq(savedSpots.spotId, spotId))
    return Number(row?.x ?? 0)
  }
}
