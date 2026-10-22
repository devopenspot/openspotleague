import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import { and, count, desc, eq, gte, inArray, isNotNull, sql, type SQL } from "drizzle-orm"
import { getDbClient, withDbRead } from "@/lib/db/client"
import {
  gamePlayers,
  gameSessions,
  profiles,
  riderScoreEvents,
  riderStats,
  savedSpots,
  verifiedSpots,
  gameRounds,
} from "@/db/schema"
import {
  RANK_THRESHOLDS,
  rankForPoints,
  buildRiderActivityGrid,
  type RiderActivityDay,
} from "@/lib/services/profile/ranking"
import type { Preferences } from "@/lib/schemas/preferences"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import type { Spot } from "@/lib/types"
import { PROFILE_CACHE_LIFE } from "@/lib/cache/lifetimes"

function profileTag(userId: string): string {
  return `profile:user:${userId}`
}
function profileGamesTag(userId: string): string {
  return `profile:games:${userId}`
}
function profileSpotsTag(userId: string): string {
  return `profile:spots:${userId}`
}
function profileTricksTag(userId: string): string {
  return `profile:tricks:${userId}`
}

export interface ProfileSummary {
  user: { id: string; name: string; email: string; initials: string }
  rank: string
  totalPoints: number
  nextRank: { label: string; pointsNeeded: number } | null
  progress: number
  stats: {
    totalPoints: number
    gamesPlayed: number
    gamesWon: number
    tricksLanded: number
    tricksFailed: number
  }
  counts: {
    saved: number
    verified: number
    visited: number
  }
  activity: readonly RiderActivityDay[]
  preferences: Preferences
  streakDays: number
}

function nextRankForPoints(points: number): { label: string; pointsNeeded: number } | null {
  // RANK_THRESHOLDS sorted descending; find next threshold above current
  const sortedAsc = [...RANK_THRESHOLDS].sort((a, b) => a.minimum - b.minimum)
  for (const r of sortedAsc) {
    if (points < r.minimum) {
      return { label: r.label, pointsNeeded: r.minimum - points }
    }
  }
  return null
}

function progressToNextRank(points: number): number {
  const sortedAsc = [...RANK_THRESHOLDS].sort((a, b) => a.minimum - b.minimum)
  let currentMin = 0
  let nextMin: number | null = null
  for (const r of sortedAsc) {
    if (points >= r.minimum) currentMin = r.minimum
    else {
      nextMin = r.minimum
      break
    }
  }
  if (nextMin === null) return 1
  if (nextMin === currentMin) return 1
  return Math.min(1, Math.max(0, (points - currentMin) / (nextMin - currentMin)))
}

function streakFromActivity(days: readonly RiderActivityDay[]): number {
  let streak = 0
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i]
    if (!day) break
    if (day.count > 0) streak += 1
    else break
  }
  return streak
}

export async function runGetProfileSummary(userId: string): Promise<ProfileSummary> {
  const { db } = getDbClient()

  const [profileRow, statsRow, savedCountRows, verifiedCountRows, visitedRows, activityEvents] =
    await Promise.all([
      withDbRead("profile.summary.profile", () =>
        db.transaction((tx) => tx.select().from(profiles).where(eq(profiles.id, userId)).limit(1)),
      ).then((rows) => rows[0] ?? null),
      withDbRead("profile.summary.riderStats", () =>
        db.transaction((tx) => tx.select().from(riderStats).where(eq(riderStats.userId, userId)).limit(1)),
      ).then((rows) => rows[0] ?? null),
      withDbRead("profile.summary.savedCount", () =>
        db.transaction((tx) =>
          tx.select({ c: count() }).from(savedSpots).where(eq(savedSpots.userId, userId)),
        ),
      ),
      withDbRead("profile.summary.verifiedCount", () =>
        db.transaction((tx) =>
          tx.select({ c: count() }).from(verifiedSpots).where(eq(verifiedSpots.userId, userId)),
        ),
      ),
      // visited = distinct verifiedSpots + distinct challenge spots via gamePlayers->gameSessions where spotId not null
      withDbRead("profile.summary.visited", () =>
        db.transaction(async (tx) => {
          const verified = await tx
            .select({ spotId: verifiedSpots.spotId })
            .from(verifiedSpots)
            .where(eq(verifiedSpots.userId, userId))
          const verifiedIds = new Set(verified.map((r) => r.spotId))
          const gameSpotRows = await tx
            .select({ spotId: gameSessions.spotId })
            .from(gameSessions)
            .innerJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
            .where(and(eq(gamePlayers.userId, userId), sql`${gameSessions.spotId} is not null`))
          for (const row of gameSpotRows) {
            if (row.spotId) verifiedIds.add(row.spotId)
          }
          return verifiedIds.size
        }),
      ),
      Promise.all([
        withDbRead("profile.summary.activityEvents.score", () => {
          const start = new Date()
          start.setUTCDate(start.getUTCDate() - 84 + 1)
          start.setUTCHours(0, 0, 0, 0)
          return db.transaction((tx) =>
            tx
              .select({ createdAt: riderScoreEvents.createdAt, points: riderScoreEvents.points })
              .from(riderScoreEvents)
              .where(and(eq(riderScoreEvents.userId, userId), gte(riderScoreEvents.createdAt, start))),
          )
        }),
        withDbRead("profile.summary.activityEvents.verified", () => {
          const start = new Date()
          start.setUTCDate(start.getUTCDate() - 84 + 1)
          start.setUTCHours(0, 0, 0, 0)
          return db.transaction((tx) =>
            tx.select({ createdAt: verifiedSpots.createdAt }).from(verifiedSpots).where(and(eq(verifiedSpots.userId, userId), gte(verifiedSpots.createdAt, start))),
          )
        }),
        withDbRead("profile.summary.activityEvents.gameSpot", () => {
          const start = new Date()
          start.setUTCDate(start.getUTCDate() - 84 + 1)
          start.setUTCHours(0, 0, 0, 0)
          return db.transaction((tx) =>
            tx
              .select({ createdAt: gameSessions.createdAt })
              .from(gameSessions)
              .where(and(eq(gameSessions.createdBy, userId), isNotNull(gameSessions.spotId), gte(gameSessions.createdAt, start))),
          )
        }),
      ]).then(([scoreEvents, verifiedEvents, gameSpotEvents]) => [
        ...scoreEvents,
        ...verifiedEvents.map((row) => ({ createdAt: row.createdAt, points: 0 })),
        ...gameSpotEvents.map((row) => ({ createdAt: row.createdAt, points: 0 })),
      ]),
    ])

  const stats = statsRow ?? {
    userId,
    totalPoints: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    tricksLanded: 0,
    tricksFailed: 0,
    updatedAt: new Date(0),
  }
  const totalPoints = stats.totalPoints ?? 0
  const rank = rankForPoints(totalPoints)
  const activity = buildRiderActivityGrid(activityEvents, new Date(), 84)
  const saved = savedCountRows[0]?.c ?? 0
  const verified = verifiedCountRows[0]?.c ?? 0
  const visited = visitedRows

  const preferences: Preferences = {
    distanceUnit: (profileRow?.distanceUnit as "mi" | "km") ?? "mi",
    temperatureUnit: (profileRow?.temperatureUnit as "C" | "F") ?? "C",
    disciplineSlug: (profileRow?.preferredDisciplineSlug as Preferences["disciplineSlug"]) ?? "all",
  }

  return {
    user: {
      id: userId,
      name: profileRow?.displayName ?? "",
      email: profileRow?.email ?? "",
      initials: profileRow?.initials ?? "",
    },
    rank,
    totalPoints,
    nextRank: nextRankForPoints(totalPoints),
    progress: progressToNextRank(totalPoints),
    stats: {
      totalPoints,
      gamesPlayed: stats.gamesPlayed ?? 0,
      gamesWon: stats.gamesWon ?? 0,
      tricksLanded: stats.tricksLanded ?? 0,
      tricksFailed: stats.tricksFailed ?? 0,
    },
    counts: {
      saved: Number(saved),
      verified: Number(verified),
      visited: Number(visited),
    },
    activity,
    preferences,
    streakDays: streakFromActivity(activity),
  }
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary> {
  "use cache"
  cacheTag(profileTag(userId))
  cacheLife(PROFILE_CACHE_LIFE)
  return runGetProfileSummary(userId)
}

export function revalidateProfile(userId: string): void {
  revalidateTag(profileTag(userId), PROFILE_CACHE_LIFE)
  revalidateTag(profileGamesTag(userId), PROFILE_CACHE_LIFE)
  revalidateTag(profileSpotsTag(userId), PROFILE_CACHE_LIFE)
  revalidateTag(profileTricksTag(userId), PROFILE_CACHE_LIFE)
}

export function revalidateProfileGames(userId: string): void {
  revalidateTag(profileGamesTag(userId), PROFILE_CACHE_LIFE)
  revalidateTag(profileTag(userId), PROFILE_CACHE_LIFE)
}

// ---------- games ----------

export interface ProfileGame {
  id: string
  mode: string
  gameFormat: string
  disciplineSlug: string
  status: string
  spotId: string | null
  createdAt: string
  updatedAt: string
  role: "creator" | "participant"
  opponents: number
  isWinner: boolean
}

export async function runListProfileGames(
  userId: string,
  opts?: { mode?: "training" | "challenge"; limit?: number; cursor?: string },
): Promise<{ items: readonly ProfileGame[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50)
  const { db } = getDbClient()
  const rows = await withDbRead("profile.games", () =>
    db.transaction(async (tx) => {
      // cursor is simple offset encoded as integer index for MVP; future can be updatedAt cursor
      let offset = 0
      if (opts?.cursor) {
        const parsed = Number.parseInt(opts.cursor, 10)
        if (Number.isFinite(parsed) && parsed >= 0) offset = parsed
      }
      const conditions: SQL[] = [eq(gamePlayers.userId, userId)]
      if (opts?.mode) conditions.push(eq(gameSessions.mode, opts.mode))
      const joined = await tx
        .select({
          id: gameSessions.id,
          mode: gameSessions.mode,
          gameFormat: gameSessions.gameFormat,
          disciplineSlug: gameSessions.disciplineSlug,
          status: gameSessions.status,
          spotId: gameSessions.spotId,
          createdAt: gameSessions.createdAt,
          updatedAt: gameSessions.updatedAt,
          createdBy: gameSessions.createdBy,
          winnerPlayerId: gameSessions.winnerPlayerId,
        })
        .from(gameSessions)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
        .where(and(...conditions))
        .orderBy(desc(gameSessions.updatedAt), desc(gameSessions.createdAt))
        .limit(limit + 1)
        .offset(offset)

      // enrich with participant counts and winner check in batch
      const gameIds = joined.map((r) => r.id)
      const playerCounts = new Map<string, number>()
      const playerIdByGame = new Map<string, string>()
      if (gameIds.length > 0) {
        const counts = await tx
          .select({ gameId: gamePlayers.gameId, c: count() })
          .from(gamePlayers)
          .where(inArray(gamePlayers.gameId, gameIds))
          .groupBy(gamePlayers.gameId)
        for (const row of counts) playerCounts.set(row.gameId, Number(row.c))
        const me = await tx
          .select({ gameId: gamePlayers.gameId, id: gamePlayers.id })
          .from(gamePlayers)
          .where(and(eq(gamePlayers.userId, userId), inArray(gamePlayers.gameId, gameIds)))
        for (const row of me) playerIdByGame.set(row.gameId, row.id)
      }

      const hasMore = joined.length > limit
      const slice = hasMore ? joined.slice(0, limit) : joined
      const nextCursor = hasMore ? String(offset + limit) : null
      return {
        items: slice.map((r) => ({
          id: r.id,
          mode: r.mode,
          gameFormat: r.gameFormat,
          disciplineSlug: r.disciplineSlug,
          status: r.status,
          spotId: r.spotId,
          createdAt: (r.createdAt as Date).toISOString(),
          updatedAt: (r.updatedAt as Date).toISOString(),
          role: r.createdBy === userId ? ("creator" as const) : ("participant" as const),
          opponents: Math.max(0, (playerCounts.get(r.id) ?? 1) - 1),
          isWinner: r.winnerPlayerId !== null && r.winnerPlayerId === playerIdByGame.get(r.id),
        })),
        nextCursor,
      }
    }),
  )
  return rows
}

export async function listProfileGames(
  userId: string,
  opts?: { mode?: "training" | "challenge"; limit?: number; cursor?: string },
): Promise<{ items: readonly ProfileGame[]; nextCursor: string | null }> {
  "use cache"
  cacheTag(profileGamesTag(userId))
  cacheLife(PROFILE_CACHE_LIFE)
  return runListProfileGames(userId, opts)
}

// ---------- spots ----------

export interface ProfileSpotsResult {
  items: readonly Spot[]
  nextCursor: string | null
  total: number
}

export async function runListProfileSpots(
  userId: string,
  kind: "saved" | "verified" | "visited",
  opts?: { limit?: number; cursor?: string },
): Promise<ProfileSpotsResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50)
  const offset = (() => {
    if (!opts?.cursor) return 0
    const n = Number.parseInt(opts.cursor, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  })()

  const { db } = getDbClient()
  const spotRepo = await getSpotRepositoryAsync()

  if (kind === "saved") {
    const ids = await withDbRead("profile.spots.savedIds", () =>
      db.transaction(async (tx) => {
        const rows = await tx
          .select({ spotId: savedSpots.spotId })
          .from(savedSpots)
          .where(eq(savedSpots.userId, userId))
          .orderBy(desc(savedSpots.createdAt))
          .limit(limit + 1)
          .offset(offset)
        return rows
      }),
    )
    const hasMore = ids.length > limit
    const pageIds = hasMore ? ids.slice(0, limit).map((r) => r.spotId) : ids.map((r) => r.spotId)
    const spotsList = pageIds.length > 0 ? await spotRepo.list({ ids: pageIds, limit: limit }) : { items: [], nextCursor: null }
    // preserve order from ids
    const map = new Map(spotsList.items.map((s) => [s.id, s]))
    const ordered = pageIds.map((id) => map.get(id)).filter(Boolean) as Spot[]
    return { items: ordered, nextCursor: hasMore ? String(offset + limit) : null, total: ordered.length }
  }

  if (kind === "verified") {
    const ids = await withDbRead("profile.spots.verifiedIds", () =>
      db.transaction(async (tx) => {
        const rows = await tx
          .select({ spotId: verifiedSpots.spotId })
          .from(verifiedSpots)
          .where(eq(verifiedSpots.userId, userId))
          .orderBy(desc(verifiedSpots.createdAt))
          .limit(limit + 1)
          .offset(offset)
        return rows
      }),
    )
    const hasMore = ids.length > limit
    const pageIds = hasMore ? ids.slice(0, limit).map((r) => r.spotId) : ids.map((r) => r.spotId)
    const spotsList = pageIds.length > 0 ? await spotRepo.list({ ids: pageIds, limit: limit }) : { items: [], nextCursor: null }
    const map = new Map(spotsList.items.map((s) => [s.id, s]))
    const ordered = pageIds.map((id) => map.get(id)).filter(Boolean) as Spot[]
    return { items: ordered, nextCursor: hasMore ? String(offset + limit) : null, total: ordered.length }
  }

  // visited = distinct verified + distinct game spotIds
  const distinctIds = await withDbRead("profile.spots.visitedIds", () =>
    db.transaction(async (tx) => {
      const verified = await tx.select({ spotId: verifiedSpots.spotId }).from(verifiedSpots).where(eq(verifiedSpots.userId, userId))
      const games = await tx
        .select({ spotId: gameSessions.spotId })
        .from(gameSessions)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
        .where(and(eq(gamePlayers.userId, userId), sql`${gameSessions.spotId} is not null`))
      const set = new Map<string, number>()
      for (const r of verified) set.set(r.spotId, 1)
      for (const r of games) if (r.spotId) set.set(r.spotId, 1)
      const all = [...set.keys()]
      // simple sort stable, paginate slice
      all.sort()
      const hasMore = all.length > offset + limit
      const page = all.slice(offset, offset + limit)
      return { page, hasMore, total: all.length }
    }),
  )
  const spotsList =
    distinctIds.page.length > 0 ? await spotRepo.list({ ids: distinctIds.page, limit: limit }) : { items: [], nextCursor: null }
  const map = new Map(spotsList.items.map((s) => [s.id, s]))
  const ordered = distinctIds.page.map((id) => map.get(id)).filter(Boolean) as Spot[]
  return {
    items: ordered,
    nextCursor: distinctIds.hasMore ? String(offset + limit) : null,
    total: distinctIds.total,
  }
}

export async function listProfileSpots(
  userId: string,
  kind: "saved" | "verified" | "visited",
  opts?: { limit?: number; cursor?: string },
): Promise<ProfileSpotsResult> {
  "use cache"
  cacheTag(profileSpotsTag(userId), profileTag(userId))
  cacheLife(PROFILE_CACHE_LIFE)
  return runListProfileSpots(userId, kind, opts)
}

// ---------- tricks ----------

export interface ProfileTricks {
  byLevel: { 1: number; 2: number; 3: number }
  totalLanded: number
  totalFailed: number
  recent: readonly { name: string; level: number; points: number; date: string }[]
}

export async function runGetProfileTricks(userId: string): Promise<ProfileTricks> {
  const { db } = getDbClient()
  const rows = await withDbRead("profile.tricks", () =>
    db.transaction((tx) =>
      tx
        .select({
          trickLevel: riderScoreEvents.trickLevel,
          points: riderScoreEvents.points,
          eventType: riderScoreEvents.eventType,
          createdAt: riderScoreEvents.createdAt,
          // try to get trick name via round -> catalog? Fallback to eventType
        })
        .from(riderScoreEvents)
        .where(eq(riderScoreEvents.userId, userId))
        .orderBy(desc(riderScoreEvents.createdAt))
        .limit(50),
    ),
  )

  // Separate landings vs fails via riderStats? riderScoreEvents only has landed events (points >0)
  // So byLevel counts landings per trickLevel where eventType in challenger/response landed
  const byLevel = { 1: 0, 2: 0, 3: 0 } as ProfileTricks["byLevel"]
  let totalLanded = 0
  for (const r of rows) {
    if (r.trickLevel !== null && r.trickLevel >= 1 && r.trickLevel <= 3 && r.eventType !== "winner_bonus") {
      const k = r.trickLevel as 1 | 2 | 3
      byLevel[k] += 1
      totalLanded += 1
    }
  }

  // totalFailed from riderStats
  const [stats] = await withDbRead("profile.tricks.stats", () =>
    db.transaction((tx) => tx.select().from(riderStats).where(eq(riderStats.userId, userId)).limit(1)),
  )
  const totalFailed = stats?.tricksFailed ?? 0
  // if landed not in stats, fallback to counted
  if (stats?.tricksLanded) totalLanded = stats.tricksLanded

  // recent landings with trick name via joining gameRounds if possible (best effort via roundId)
  // For now map without name lookup; enrich with trickLevel label
  const recent = rows
    .filter((r) => r.eventType !== "winner_bonus" && r.trickLevel !== null)
    .slice(0, 10)
    .map((r) => ({
      name: r.eventType === "challenger_landed" ? "Challenger landed" : r.eventType === "response_landed" ? "Response landed" : "Trick",
      level: r.trickLevel as number,
      points: r.points,
      date: (r.createdAt as Date).toISOString(),
    }))

  // Enrich names from gameRounds trickNameSnapshot in batch
  try {
    if (rows.length > 0) {
      const withRounds = await withDbRead("profile.tricks.enrich", () =>
        db.transaction((tx) =>
          tx
            .select({
              trickName: gameRounds.trickNameSnapshot,
              trickLevel: riderScoreEvents.trickLevel,
              points: riderScoreEvents.points,
              eventType: riderScoreEvents.eventType,
              createdAt: riderScoreEvents.createdAt,
            })
            .from(riderScoreEvents)
            .leftJoin(gameRounds, eq(gameRounds.id, riderScoreEvents.roundId))
            .where(eq(riderScoreEvents.userId, userId))
            .orderBy(desc(riderScoreEvents.createdAt))
            .limit(10),
        ),
      )
      if (withRounds.length > 0) {
        const enrichedRecent = withRounds
          .filter((r) => r.eventType !== "winner_bonus" && r.trickLevel !== null)
          .slice(0, 10)
          .map((r) => ({
            name: r.trickName ?? (r.eventType === "challenger_landed" ? "Challenger landed" : "Response landed"),
            level: r.trickLevel as number,
            points: r.points,
            date: (r.createdAt as Date).toISOString(),
          }))
        if (enrichedRecent.length > 0) {
          return { byLevel, totalLanded, totalFailed, recent: enrichedRecent }
        }
      }
    }
  } catch {
    // ignore enrichment failures
  }

  return { byLevel, totalLanded, totalFailed, recent }
}

export async function getProfileTricks(userId: string): Promise<ProfileTricks> {
  "use cache"
  cacheTag(profileTricksTag(userId))
  cacheLife(PROFILE_CACHE_LIFE)
  return runGetProfileTricks(userId)
}
