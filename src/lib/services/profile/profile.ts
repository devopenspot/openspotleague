import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import { and, count, desc, eq, gte, inArray, isNotNull, ne, type SQL } from "drizzle-orm"
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
import type { TrickLevel } from "@/lib/schemas/game"
import { PROFILE_CACHE_LIFE } from "@/lib/cache/lifetimes"
import {
  listLeagueHistory,
  loadLeagueActivityEvents,
  type LeagueHistoryItem,
} from "@/lib/services/league/activity"

export function profileTag(userId: string): string {
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
    eventsAttended: number
    eventsWon: number
  }
  /** Latest published League results (contests ridden). */
  leagueHistory: LeagueHistoryItem[]
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

/**
 * Distinct spots the rider has been to: spots they verified plus spots of
 * games they played. Two independent reads, no transaction (one round trip each).
 */
async function loadVisitedSpotIds(userId: string): Promise<string[]> {
  const { db } = getDbClient()
  const [verified, games] = await Promise.all([
    withDbRead("profile.visited.verified", () =>
      db.select({ spotId: verifiedSpots.spotId }).from(verifiedSpots).where(eq(verifiedSpots.userId, userId)),
    ),
    withDbRead("profile.visited.games", () =>
      db
        .select({ spotId: gameSessions.spotId })
        .from(gameSessions)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
        .where(and(eq(gamePlayers.userId, userId), isNotNull(gameSessions.spotId))),
    ),
  ])
  const ids = new Set<string>()
  for (const row of verified) ids.add(row.spotId)
  for (const row of games) if (row.spotId) ids.add(row.spotId)
  return [...ids]
}

export async function runGetProfileSummary(userId: string): Promise<ProfileSummary> {
  const { db } = getDbClient()

  const activityStart = new Date()
  activityStart.setUTCDate(activityStart.getUTCDate() - 84 + 1)
  activityStart.setUTCHours(0, 0, 0, 0)
  const [profileRow, statsRow, savedCountRows, verifiedCountRows, visitedRows, activityEvents, leagueHistory] =
    await Promise.all([
      withDbRead("profile.summary.profile", () =>
        db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
      ).then((rows) => rows[0] ?? null),
      withDbRead("profile.summary.riderStats", () =>
        db.select().from(riderStats).where(eq(riderStats.userId, userId)).limit(1),
      ).then((rows) => rows[0] ?? null),
      withDbRead("profile.summary.savedCount", () =>
        db.select({ c: count() }).from(savedSpots).where(eq(savedSpots.userId, userId)),
      ),
      withDbRead("profile.summary.verifiedCount", () =>
        db.select({ c: count() }).from(verifiedSpots).where(eq(verifiedSpots.userId, userId)),
      ),
      // visited = distinct verifiedSpots + distinct challenge spots via gamePlayers->gameSessions where spotId not null
      loadVisitedSpotIds(userId).then((ids) => ids.length),
      Promise.all([
        withDbRead("profile.summary.activityEvents.score", () =>
          db
            .select({ createdAt: riderScoreEvents.createdAt, points: riderScoreEvents.points })
            .from(riderScoreEvents)
            .where(and(eq(riderScoreEvents.userId, userId), gte(riderScoreEvents.createdAt, activityStart))),
        ),
        withDbRead("profile.summary.activityEvents.verified", () =>
          db
            .select({ createdAt: verifiedSpots.createdAt })
            .from(verifiedSpots)
            .where(and(eq(verifiedSpots.userId, userId), gte(verifiedSpots.createdAt, activityStart))),
        ),
        withDbRead("profile.summary.activityEvents.gameSpot", () =>
          db
            .select({ createdAt: gameSessions.createdAt })
            .from(gameSessions)
            .where(and(eq(gameSessions.createdBy, userId), isNotNull(gameSessions.spotId), gte(gameSessions.createdAt, activityStart))),
        ),
        loadLeagueActivityEvents(userId, activityStart),
      ]).then(([scoreEvents, verifiedEvents, gameSpotEvents, leagueEvents]) => [
        ...scoreEvents,
        ...verifiedEvents.map((row) => ({ createdAt: row.createdAt, points: 0 })),
        ...gameSpotEvents.map((row) => ({ createdAt: row.createdAt, points: 0 })),
        ...leagueEvents,
      ]),
      listLeagueHistory(userId),
    ])

  const stats = statsRow ?? {
    userId,
    totalPoints: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    tricksLanded: 0,
    tricksFailed: 0,
    eventsAttended: 0,
    eventsWon: 0,
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
      eventsAttended: stats.eventsAttended ?? 0,
      eventsWon: stats.eventsWon ?? 0,
    },
    leagueHistory,
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
  // Cursor is an integer offset for now; an updatedAt cursor can replace it later.
  let offset = 0
  if (opts?.cursor) {
    const parsed = Number.parseInt(opts.cursor, 10)
    if (Number.isFinite(parsed) && parsed >= 0) offset = parsed
  }
  const conditions: SQL[] = [eq(gamePlayers.userId, userId)]
  if (opts?.mode) conditions.push(eq(gameSessions.mode, opts.mode))
  const joined = await withDbRead("profile.games", () =>
    db
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
        myPlayerId: gamePlayers.id,
      })
      .from(gameSessions)
      .innerJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
      .where(and(...conditions))
      .orderBy(desc(gameSessions.updatedAt), desc(gameSessions.createdAt))
      .limit(limit + 1)
      .offset(offset),
  )

  const hasMore = joined.length > limit
  const slice = hasMore ? joined.slice(0, limit) : joined
  const gameIds = slice.map((r) => r.id)
  const playerCounts = new Map<string, number>()
  if (gameIds.length > 0) {
    const counts = await withDbRead("profile.games.playerCounts", () =>
      db
        .select({ gameId: gamePlayers.gameId, c: count() })
        .from(gamePlayers)
        .where(inArray(gamePlayers.gameId, gameIds))
        .groupBy(gamePlayers.gameId),
    )
    for (const row of counts) playerCounts.set(row.gameId, Number(row.c))
  }

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
      isWinner: r.winnerPlayerId !== null && r.winnerPlayerId === r.myPlayerId,
    })),
    nextCursor: hasMore ? String(offset + limit) : null,
  }
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
      db
        .select({ spotId: savedSpots.spotId })
        .from(savedSpots)
        .where(eq(savedSpots.userId, userId))
        .orderBy(desc(savedSpots.createdAt))
        .limit(limit + 1)
        .offset(offset),
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
      db
        .select({ spotId: verifiedSpots.spotId })
        .from(verifiedSpots)
        .where(eq(verifiedSpots.userId, userId))
        .orderBy(desc(verifiedSpots.createdAt))
        .limit(limit + 1)
        .offset(offset),
    )
    const hasMore = ids.length > limit
    const pageIds = hasMore ? ids.slice(0, limit).map((r) => r.spotId) : ids.map((r) => r.spotId)
    const spotsList = pageIds.length > 0 ? await spotRepo.list({ ids: pageIds, limit: limit }) : { items: [], nextCursor: null }
    const map = new Map(spotsList.items.map((s) => [s.id, s]))
    const ordered = pageIds.map((id) => map.get(id)).filter(Boolean) as Spot[]
    return { items: ordered, nextCursor: hasMore ? String(offset + limit) : null, total: ordered.length }
  }

  // visited = distinct verified + distinct game spotIds
  // Sorted for a stable page order across requests.
  const allVisited = (await loadVisitedSpotIds(userId)).sort()
  const distinctIds = {
    page: allVisited.slice(offset, offset + limit),
    hasMore: allVisited.length > offset + limit,
    total: allVisited.length,
  }
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

export type TrickLevelCounts = Record<TrickLevel, number>

export interface ProfileTricks {
  /** Lifetime landings per trick level (1–5). */
  byLevel: TrickLevelCounts
  totalLanded: number
  totalFailed: number
  recent: readonly { name: string; level: number; points: number; date: string }[]
}

const TRICK_LEVELS: readonly TrickLevel[] = [1, 2, 3, 4, 5]

/** Grouped `(trick_level, count)` rows → a full 1–5 map; unknown levels are dropped. */
export function tricksByLevel(rows: readonly { level: number | null; count: number | string }[]): TrickLevelCounts {
  const byLevel: TrickLevelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const row of rows) {
    const level = TRICK_LEVELS.find((candidate) => candidate === row.level)
    if (level !== undefined) byLevel[level] += Number(row.count)
  }
  return byLevel
}

function landingName(eventType: string): string {
  return eventType === "challenger_landed" ? "Challenger landed" : eventType === "response_landed" ? "Response landed" : "Trick"
}

export async function runGetProfileTricks(userId: string): Promise<ProfileTricks> {
  const { db } = getDbClient()
  const landed = and(
    eq(riderScoreEvents.userId, userId),
    ne(riderScoreEvents.eventType, "winner_bonus"),
    isNotNull(riderScoreEvents.trickLevel),
  )
  const [levelRows, statsRows, recentRows] = await Promise.all([
    withDbRead("profile.tricks.byLevel", () =>
      db
        .select({ level: riderScoreEvents.trickLevel, count: count() })
        .from(riderScoreEvents)
        .where(landed)
        .groupBy(riderScoreEvents.trickLevel),
    ),
    withDbRead("profile.tricks.stats", () =>
      db
        .select({ tricksLanded: riderStats.tricksLanded, tricksFailed: riderStats.tricksFailed })
        .from(riderStats)
        .where(eq(riderStats.userId, userId))
        .limit(1),
    ),
    withDbRead("profile.tricks.recent", () =>
      db
        .select({
          trickName: gameRounds.trickNameSnapshot,
          trickLevel: riderScoreEvents.trickLevel,
          points: riderScoreEvents.points,
          eventType: riderScoreEvents.eventType,
          createdAt: riderScoreEvents.createdAt,
        })
        .from(riderScoreEvents)
        .leftJoin(gameRounds, eq(gameRounds.id, riderScoreEvents.roundId))
        .where(landed)
        .orderBy(desc(riderScoreEvents.createdAt))
        .limit(10),
    ),
  ])

  const byLevel = tricksByLevel(levelRows)
  const counted = TRICK_LEVELS.reduce((sum, level) => sum + byLevel[level], 0)
  const stats = statsRows[0]
  return {
    byLevel,
    totalLanded: stats?.tricksLanded || counted,
    totalFailed: stats?.tricksFailed ?? 0,
    recent: recentRows.map((r) => ({
      name: r.trickName ?? landingName(r.eventType),
      level: r.trickLevel as number,
      points: r.points,
      date: (r.createdAt as Date).toISOString(),
    })),
  }
}

export async function getProfileTricks(userId: string): Promise<ProfileTricks> {
  "use cache"
  cacheTag(profileTricksTag(userId))
  cacheLife(PROFILE_CACHE_LIFE)
  return runGetProfileTricks(userId)
}
