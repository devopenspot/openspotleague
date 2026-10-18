import { cacheLife, cacheTag } from "next/cache"
import { and, desc, eq, gte, isNotNull } from "drizzle-orm"
import { getDbClient, withDbRead } from "@/lib/db/client"
import { gameSessions, riderScoreEvents, riderStats, verifiedSpots } from "@/db/schema"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

export const RANK_THRESHOLDS = [
  { minimum: 2584, label: "Blade Master" },
  { minimum: 1597, label: "Flow Rider" },
  { minimum: 610, label: "Line Builder" },
  { minimum: 144, label: "Street Learner" },
  { minimum: 0, label: "New Rider" },
] as const

export function rankForPoints(points: number): string {
  return RANK_THRESHOLDS.find((rank) => points >= rank.minimum)?.label ?? "New Rider"
}

export async function runGetRiderRanking(userId: string) {
  const { db } = getDbClient()
  const [stats] = await withDbRead(
    "ranking.get_rider",
    () => db.transaction((tx) =>
      tx.select().from(riderStats).where(eq(riderStats.userId, userId)),
    ),
  )
  const value = stats ?? { userId, totalPoints: 0, gamesPlayed: 0, gamesWon: 0, tricksLanded: 0, tricksFailed: 0, updatedAt: new Date(0) }
  return { ...value, rank: rankForPoints(value.totalPoints) }
}

export async function getRiderRanking(userId: string) {
  "use cache"
  cacheTag(`ranking:user:${userId}`)
  cacheLife(LIST_CACHE_LIFE)
  return runGetRiderRanking(userId)
}

export async function runListRanking(limit = 50) {
  const { db } = getDbClient()
  const rows = await withDbRead(
    "ranking.list",
    () => db.transaction((tx) =>
      tx.select().from(riderStats).orderBy(desc(riderStats.totalPoints), riderStats.userId).limit(limit),
    ),
  )
  return rows.map((row) => ({ ...row, rank: rankForPoints(row.totalPoints) }))
}

export async function listRanking(limit = 50) {
  "use cache"
  cacheTag("ranking:global")
  cacheLife(LIST_CACHE_LIFE)
  return runListRanking(limit)
}

export interface RiderActivityDay {
  date: string
  count: number
  points: number
}

export function buildRiderActivityGrid(
  events: readonly { createdAt: Date | string; points: number }[],
  endDate = new Date(),
  dayCount = 84,
): readonly RiderActivityDay[] {
  const end = new Date(endDate)
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - dayCount + 1)
  const days = new Map<string, RiderActivityDay>()
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + offset)
    const key = date.toISOString().slice(0, 10)
    days.set(key, { date: key, count: 0, points: 0 })
  }
  for (const event of events) {
    const key = new Date(event.createdAt).toISOString().slice(0, 10)
    const day = days.get(key)
    if (day) {
      day.count += 1
      day.points += event.points
    }
  }
  return [...days.values()]
}

export async function getRiderActivity(userId: string, dayCount = 84) {
  const { db } = getDbClient()
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - dayCount + 1)
  start.setUTCHours(0, 0, 0, 0)
  const [scoreEvents, verifiedEvents, gameSpotEvents] = await Promise.all([
    withDbRead("ranking.activity.score", () =>
      db.transaction((tx) =>
        tx
          .select({ createdAt: riderScoreEvents.createdAt, points: riderScoreEvents.points })
          .from(riderScoreEvents)
          .where(and(eq(riderScoreEvents.userId, userId), gte(riderScoreEvents.createdAt, start))),
      ),
    ),
    withDbRead("ranking.activity.verified", () =>
      db.transaction((tx) =>
        tx
          .select({ createdAt: verifiedSpots.createdAt })
          .from(verifiedSpots)
          .where(and(eq(verifiedSpots.userId, userId), gte(verifiedSpots.createdAt, start))),
      ),
    ),
    withDbRead("ranking.activity.gameSpot", () =>
      db.transaction((tx) =>
        tx
          .select({ createdAt: gameSessions.createdAt })
          .from(gameSessions)
          .where(
            and(
              eq(gameSessions.createdBy, userId),
              isNotNull(gameSessions.spotId),
              gte(gameSessions.createdAt, start),
            ),
          ),
      ),
    ),
  ])
  const spotEvents = [
    ...verifiedEvents.map((row) => ({ createdAt: row.createdAt, points: 0 })),
    ...gameSpotEvents.map((row) => ({ createdAt: row.createdAt, points: 0 })),
  ]
  return buildRiderActivityGrid([...scoreEvents, ...spotEvents], end, dayCount)
}
