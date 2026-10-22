import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm"
import { createHmac } from "node:crypto"
import { z } from "zod"
import { requestFingerprint } from "./idempotency"
import { getDbClient, withDbRead, withDbWrite } from "@/lib/db/client"
import { env } from "@/lib/config/env"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import {
  challengeCatalogs,
  challengeCatalogTricks,
  challengeTrickSpotTypes,
  gameActionRequests,
  gameAttempts,
  gameLocationVerifications,
  gamePlayers,
  gameRaceLaps,
  gameRealtimeSignals,
  gameRounds,
  gameSessions,
  riderScoreEvents,
  riderStats,
  spotDisciplines,
  spotChallengeRecords,
  spotTypeAssignments,
  spotTypes,
  spots,
  verifiedSpots,
} from "@/db/schema"
import {
  createLobby,
  prepareNextRound,
  selectAlternativeTrickForSpotType,
  selectChallengeSettings as selectChallengeSettingsEngine,
  selectLevel as selectLevelEngine,
  selectSpotType as selectSpotTypeEngine,
  startGame as startGameEngine,
  startSoloTraining as startSoloTrainingEngine,
  submitChallengerResult as submitChallengerResultEngine,
  submitResponse as submitResponseEngine,
} from "@/lib/games/engine"
import {
  assertGuestAllowedOnTraining,
  identityActorId,
  identityMatches,
  isGuest,
  requireGuestName,
  type Identity,
} from "@/lib/games/guest"
import {
  DEFAULT_LOCATION_RADIUS_METERS,
  GAME_DEFINITIONS,
  GameDomainError,
  LEVEL_POINTS,
  PLAYER_LIMITS,
  WINNER_BONUS_POINTS,
  type GameState,
  type Player,
  type Round,
} from "@/lib/games/definitions"
import { locationInputSchema, verifyLocation } from "@/lib/games/location"
import {
  gameMutationResponseSchema,
  gameListResponseSchema,
  gameHistoryResponseSchema,
  gameStateSchema,
  type createGameInputSchema,
  gameCreationOptionsSchema,
  openTrainingGamesResponseSchema,
  spotTypeSnapshotSchema,
  type DisciplineSlug,
  type GameFormat,
  type GameHistoryResponse,
  type GameCreationOptions,
  type GameListResponse,
  type GameMode,
  type GameState as GameStateProjection,
  type GameStage,
  type OpenTrainingGamesResponse,
  type ScoreEventType,
  type SpotTypeSnapshot,
  type TrainingVariant,
  type TrickCatalog,
  type TrickLevel,
} from "@/lib/schemas/game"
import { cacheLife, cacheTag } from "next/cache"
import {
  TRAINING_GAME_LIMIT,
  challengeActiveExpiry,
  challengeLobbyExpiry,
  trainingGameExpiry,
} from "@/lib/games/training-limits"
import { log } from "@/lib/utils/log"
import {
  ensureCurrentTrickCatalogSnapshot,
  readCurrentTrickCatalog,
} from "@/lib/repositories/taxonomy/trick-catalog-store"
import { queueTagRevalidate } from "@/lib/cache/deferred"
import { LIST_CACHE_LIFE, PROFILE_CACHE_LIFE, REPORT_CACHE_LIFE } from "@/lib/cache/lifetimes"
import {
  DEFAULT_GAME_HISTORY_LIMIT,
  MAX_GAME_HISTORY_LIMIT,
} from "@/lib/config/constants"

const VERIFIED_CACHE_LIFE = PROFILE_CACHE_LIFE

type Db = ReturnType<typeof getDbClient>["db"]
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
type RacingSessionFields = { gameFormat: string; lapCount: number | null; ghostMode: string }

type CreateGameInput = z.infer<typeof createGameInputSchema>

type MutationInput = {
  expectedVersion: number
  idempotencyKey: string
}

type StartGameInput = MutationInput & {
  startNow?: boolean
}
const RACE_LAP_STATE_LIMIT = 160

function creatorIpHash(ip: string): string {
  const secret = env.SUPABASE_SECRET_KEY
  if (!secret) throw Object.assign(new Error("Auth config missing"), { name: "AuthConfigError" })
  return createHmac("sha256", secret).update(ip).digest("hex")
}

type RoundActionInput = MutationInput & { roundId: string }

const actionResponseSchema = gameMutationResponseSchema

function shareCode(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url")
}

function requireGamePolicy(): { maxAccuracy: number; ttlSeconds: number } {
  if (!env.GAME_LOCATION_MAX_ACCURACY_METERS || !env.GAME_LOCATION_VERIFICATION_TTL_SECONDS) {
    throw new GameDomainError("INVALID_INPUT", "Game location policy is not configured")
  }
  return {
    maxAccuracy: env.GAME_LOCATION_MAX_ACCURACY_METERS,
    ttlSeconds: env.GAME_LOCATION_VERIFICATION_TTL_SECONDS,
  }
}

/**
 * Idempotency fingerprint for game creation. Now uses canonical JSON
 * (sorted keys) via requestFingerprint — key order is no longer load-bearing.
 * Legacy rows are still accepted via isFingerprintMatch fallback.
 */
function fingerprintFor(input: CreateGameInput): string {
  const challenge = input.mode === "challenge"
  if (challenge) {
    return requestFingerprint({
      mode: "challenge",
      ruleMode: input.ruleMode ?? "flexible",
      gameFormat: input.gameFormat ?? "tricks",
      lapCount: input.lapCount ?? null,
      ghostMode: input.ghostMode ? "global_best" : "off",
      disciplineSlug: input.disciplineSlug,
      spotId: input.spotId,
      spotType: input.spotType ?? null,
      level: input.level ?? null,
      startDelayMinutes: input.startDelayMinutes,
      timezone: input.timezone,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      weatherForecastIcon: (input as { weatherForecastIcon?: string }).weatherForecastIcon ?? null,
      weatherObservedIcon: (input as { weatherObservedIcon?: string }).weatherObservedIcon ?? null,
      weatherConfirmed: (input as { weatherConfirmed?: boolean }).weatherConfirmed ?? null,
      expectedVersion: input.expectedVersion,
    })
  }
  return requestFingerprint({
    mode: "training",
    ruleMode: input.ruleMode ?? "flexible",
    gameFormat: input.gameFormat ?? "tricks",
    lapCount: input.lapCount ?? null,
    ghostMode: input.ghostMode ? "global_best" : "off",
    disciplineSlug: input.disciplineSlug,
    spotId: (input as { spotId?: string }).spotId ?? null,
    spotType: input.spotType ?? null,
    level: input.level ?? null,
    latitude: (input as { latitude?: number }).latitude ?? null,
    longitude: (input as { longitude?: number }).longitude ?? null,
    accuracyMeters: (input as { accuracyMeters?: number }).accuracyMeters ?? null,
    weatherForecastIcon: (input as { weatherForecastIcon?: string }).weatherForecastIcon ?? null,
    weatherObservedIcon: (input as { weatherObservedIcon?: string }).weatherObservedIcon ?? null,
    weatherConfirmed: (input as { weatherConfirmed?: boolean }).weatherConfirmed ?? null,
    expectedVersion: input.expectedVersion,
  })
}

async function findIdempotentResult(
  tx: Tx,
  input: { identity: Identity; action: string; idempotencyKey: string; fingerprint: string; gameId?: string },
) {
  const [request] = await tx
    .select()
    .from(gameActionRequests)
    .where(and(
      input.identity.userId ? eq(gameActionRequests.userId, input.identity.userId) : isNull(gameActionRequests.userId),
      input.identity.guestToken ? eq(gameActionRequests.guestToken, input.identity.guestToken) : isNull(gameActionRequests.guestToken),
      input.gameId !== undefined ? eq(gameActionRequests.gameId, input.gameId) : undefined,
      eq(gameActionRequests.action, input.action),
      eq(gameActionRequests.idempotencyKey, input.idempotencyKey),
    ))
  if (!request) return null
  if (request.requestFingerprint !== input.fingerprint) {
    throw new GameDomainError("IDEMPOTENCY_REUSE", "The idempotency key was reused with a different request")
  }
  const parsed = actionResponseSchema.safeParse(request.responseMetadata)
  if (!parsed.success) throw new GameDomainError("INVALID_TRANSITION", "Stored action response is invalid")
  return parsed.data
}

async function lockGameSession(tx: Tx, gameId: string) {
  const [game] = await tx
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, gameId))
    .for("update")
  if (!game) throw new GameDomainError("INVALID_INPUT", "Game not found")
  return game
}

function signalTypeForStatus(status: string): "game_state_changed" | "game_completed" | "game_cancelled" {
  if (status === "complete") return "game_completed"
  if (status === "cancelled") return "game_cancelled"
  return "game_state_changed"
}

type ActionRecordInput = {
  gameId: string
  identity: Identity
  action: string
  idempotencyKey: string
  requestFingerprint: string
  resultingVersion: number
  response: z.infer<typeof actionResponseSchema>
}

async function recordGameAction(tx: Tx, input: ActionRecordInput) {
  await tx.insert(gameActionRequests).values({
    gameId: input.gameId,
    userId: input.identity.userId,
    guestToken: input.identity.guestToken,
    action: input.action,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
    resultingVersion: input.resultingVersion,
    responseMetadata: input.response,
  })
}

async function recordGameSignal(tx: Tx, input: { gameId: string; version: number; status: string }) {
  await tx.insert(gameRealtimeSignals).values({
    gameId: input.gameId,
    version: input.version,
    signalType: signalTypeForStatus(input.status),
  }).onConflictDoNothing()
  if (
    (input.status === "complete" || input.status === "cancelled") &&
    typeof (tx as { delete?: unknown }).delete === "function"
  ) {
    await tx
      .delete(gameRealtimeSignals)
      .where(and(
        eq(gameRealtimeSignals.gameId, input.gameId),
        lt(gameRealtimeSignals.version, input.version),
      ))
  }
}

async function recordGameMutation(
  tx: Tx,
  input: ActionRecordInput & { status: string },
) {
  // The database trigger is the first line of defense for updates. The
  // conflict-safe insert also covers initial version-zero creation and keeps
  // the signal part of the same authoritative transaction.
  await recordGameSignal(tx, {
    gameId: input.gameId,
    version: input.resultingVersion,
    status: input.status,
  })
  await recordGameAction(tx, input)
}

export async function cancelExpiredTrainingGames(tx: Tx, expiry: Date) {
  const expired = await tx
    .select({ id: gameSessions.id, currentRoundId: gameSessions.currentRoundId, version: gameSessions.version })
    .from(gameSessions)
    .where(and(
      eq(gameSessions.mode, "training"),
      inArray(gameSessions.status, ["lobby", "active"]),
      lt(gameSessions.updatedAt, expiry),
    ))
    .orderBy(asc(gameSessions.id))
    .for("update")

  for (const game of expired) {
    const version = game.version + 1
    const now = new Date()
    await tx.update(gameSessions).set({
      status: "cancelled",
      version,
      cancelledAt: now,
      updatedAt: now,
    }).where(eq(gameSessions.id, game.id))
    await recordGameSignal(tx, { gameId: game.id, version, status: "cancelled" })
  }

  const roundIds = expired.flatMap((game) => game.currentRoundId ? [game.currentRoundId] : [])
  if (roundIds.length > 0) {
    await tx.update(gameRounds).set({
      status: "cancelled",
      resolvedAt: sql`coalesce(${gameRounds.resolvedAt}, now())`,
    }).where(and(
      inArray(gameRounds.id, roundIds),
      sql`${gameRounds.status} not in ('cancelled', 'resolved')`,
    ))
  }

  const expiredIds = expired.map((game) => game.id)
  if (expiredIds.length > 0 && typeof (tx as { delete?: unknown }).delete === "function") {
    await tx.delete(gameRealtimeSignals).where(inArray(gameRealtimeSignals.gameId, expiredIds))
  }
}

export async function cancelExpiredChallengeGames(tx: Tx, now = new Date()) {
  const lobbyExpiry = challengeLobbyExpiry(now)
  const activeExpiry = challengeActiveExpiry(now)
  const expired = await tx
    .select({ id: gameSessions.id, currentRoundId: gameSessions.currentRoundId, version: gameSessions.version })
    .from(gameSessions)
    .where(and(
      eq(gameSessions.mode, "challenge"),
      or(
        and(
          eq(gameSessions.status, "lobby"),
          sql`coalesce(${gameSessions.scheduledStartAt}, ${gameSessions.updatedAt}) < ${lobbyExpiry}`,
        ),
        and(
          eq(gameSessions.status, "active"),
          lt(gameSessions.updatedAt, activeExpiry),
        ),
      ),
    ))
    .orderBy(asc(gameSessions.id))
    .for("update")

  for (const game of expired) {
    const version = game.version + 1
    await tx.update(gameSessions).set({
      status: "cancelled",
      version,
      cancelledAt: now,
      updatedAt: now,
    }).where(eq(gameSessions.id, game.id))
    await recordGameSignal(tx, { gameId: game.id, version, status: "cancelled" })
  }

  const roundIds = expired.flatMap((game) => game.currentRoundId ? [game.currentRoundId] : [])
  if (roundIds.length > 0) {
    await tx.update(gameRounds).set({
      status: "cancelled",
      resolvedAt: sql`coalesce(${gameRounds.resolvedAt}, now())`,
    }).where(and(
      inArray(gameRounds.id, roundIds),
      sql`${gameRounds.status} not in ('cancelled', 'resolved')`,
    ))
  }

  const expiredIds = expired.map((game) => game.id)
  if (expiredIds.length > 0 && typeof (tx as { delete?: unknown }).delete === "function") {
    await tx.delete(gameRealtimeSignals).where(inArray(gameRealtimeSignals.gameId, expiredIds))
  }
}

function assertActiveGame(game: { status: string }) {
  if (game.status !== "active") {
    throw new GameDomainError("INVALID_TRANSITION", "This game is not active")
  }
}

function identityWhereClause(identity: Identity) {
  if (identity.userId) return eq(gamePlayers.userId, identity.userId)
  if (identity.guestToken) return eq(gamePlayers.guestToken, identity.guestToken)
  return sql`false`
}

async function resolveCatalogId(tx: Tx, disciplineSlug: DisciplineSlug): Promise<string> {
  try {
    return await ensureCurrentTrickCatalogSnapshot(tx, disciplineSlug)
  } catch (error) {
    if (error instanceof Error && error.message === "A catalog must contain at least one trick") {
      throw new GameDomainError("INVALID_INPUT", "No tricks are registered for the game discipline")
    }
    throw error
  }
}

type CachedCatalog = {
  catalog: TrickCatalog
  idBySourceId: Map<string, string>
}
const catalogCache = new Map<string, CachedCatalog>()

async function loadPersistedCatalog(tx: Tx, catalogId: string, discipline: DisciplineSlug): Promise<TrickCatalog> {
  const cached = catalogCache.get(catalogId)
  if (cached && cached.catalog.discipline === discipline) {
    return cached.catalog
  }
  const [catalog] = await tx.select().from(challengeCatalogs).where(eq(challengeCatalogs.id, catalogId))
  if (!catalog || catalog.disciplineSlug !== discipline) {
    throw new GameDomainError("INVALID_TRANSITION", "The game catalog does not match its discipline")
  }
  const tricks = await tx.select().from(challengeCatalogTricks).where(eq(challengeCatalogTricks.catalogId, catalogId))
  const compatibility = await tx
    .select({ trickId: challengeTrickSpotTypes.trickId, spotTypeSlug: challengeTrickSpotTypes.spotTypeSlug })
    .from(challengeTrickSpotTypes)
    .innerJoin(challengeCatalogTricks, eq(challengeCatalogTricks.id, challengeTrickSpotTypes.trickId))
    .where(eq(challengeCatalogTricks.catalogId, catalogId))
  const compatibleByTrick = new Map<string, string[]>()
  for (const row of compatibility) {
    const values = compatibleByTrick.get(row.trickId) ?? []
    values.push(row.spotTypeSlug)
    compatibleByTrick.set(row.trickId, values)
  }
  const idBySourceId = new Map<string, string>()
  for (const trick of tricks) {
    idBySourceId.set(trick.sourceId, trick.id)
  }
  const trickCatalog: TrickCatalog = {
    discipline,
    tricks: tricks.map((trick) => ({
      id: trick.sourceId,
      name: trick.name,
      description: trick.description,
      level: trick.level as TrickLevel,
      discipline,
      compatibleSpotTypes: compatibleByTrick.get(trick.id) ?? [],
      categories: (trick.categories as readonly string[] | null) ? [...((trick.categories as readonly string[]))].map((c) => String(c).trim().toLowerCase()).filter((c) => c.length>0).sort() : [],
    })),
  }
  catalogCache.set(catalogId, { catalog: trickCatalog, idBySourceId })
  return trickCatalog
}

export async function runGetGameCreationOptions(
  discipline: DisciplineSlug,
): Promise<GameCreationOptions> {
  const { db } = getDbClient()
  return withDbRead("games.creation_options", async () => {
    const [current, rows] = await Promise.all([
      readCurrentTrickCatalog(db, discipline),
      db
        .select({ slug: spotTypes.slug, name: spotTypes.name, sortOrder: spotTypes.sortOrder })
        .from(spotTypes)
        .orderBy(asc(spotTypes.sortOrder), asc(spotTypes.name)),
    ])
    const catalog: TrickCatalog = {
      discipline,
      tricks: current.tricks.map((trick) => ({
        id: trick.sourceId,
        name: trick.name,
        description: trick.description,
        level: trick.level,
        discipline,
        compatibleSpotTypes: [...trick.compatibleSpotTypes],
        categories: [...(trick.categories ?? [])],
      })),
    }

    const levelsBySpotType = new Map<string, Set<TrickLevel>>()
    for (const trick of catalog.tricks) {
      for (const spotType of trick.compatibleSpotTypes) {
        const levels = levelsBySpotType.get(spotType) ?? new Set<TrickLevel>()
        levels.add(trick.level)
        levelsBySpotType.set(spotType, levels)
      }
    }

    const distinctCategories = [...new Set(catalog.tricks.flatMap((t) => t.categories.map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0)))].sort()

    return gameCreationOptionsSchema.parse({
      disciplineSlug: discipline,
      spotTypes: rows.flatMap((row) => {
        const levels = levelsBySpotType.get(row.slug)
        if (!levels || levels.size === 0) return []
        return [{
          slug: row.slug,
          name: row.name,
          sortOrder: row.sortOrder,
          levels: [...levels].sort((left, right) => left - right),
        }]
      }),
      categories: distinctCategories,
      tricks: catalog.tricks,
    })
  })
}

export async function getGameCreationOptions(
  discipline: DisciplineSlug,
): Promise<GameCreationOptions> {
  "use cache"
  cacheTag("trick-catalogs:current")
  cacheTag(`games:catalog:${discipline}`)
  cacheTag("spot-types:all")
  cacheLife(LIST_CACHE_LIFE)
  return runGetGameCreationOptions(discipline)
}

export async function findNearbyChallengeSpot(input: {
  latitude: number
  longitude: number
  disciplineSlug: DisciplineSlug
}) {
  const options = await getGameCreationOptions(input.disciplineSlug)
  const repo = await getSpotRepositoryAsync()
  return repo.findNearest({
    lat: input.latitude,
    lon: input.longitude,
    radiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
    disciplineSlug: input.disciplineSlug,
    spotTypeSlugs: options.spotTypes.map((spotType) => spotType.slug),
  })
}

async function catalogTrickIdForSource(tx: Tx, catalogId: string, sourceId: string): Promise<string> {
  const cached = catalogCache.get(catalogId)?.idBySourceId.get(sourceId)
  if (cached) return cached
  const [trick] = await tx
    .select({ id: challengeCatalogTricks.id })
    .from(challengeCatalogTricks)
    .where(and(eq(challengeCatalogTricks.catalogId, catalogId), eq(challengeCatalogTricks.sourceId, sourceId)))
  if (!trick) throw new GameDomainError("NO_COMPATIBLE_TRICK", "The selected trick is not in the game catalog")
  catalogCache.get(catalogId)?.idBySourceId.set(sourceId, trick.id)
  return trick.id
}

function parseSpotTypeSnapshots(value: unknown): SpotTypeSnapshot[] {
  const parsed = z.array(spotTypeSnapshotSchema).safeParse(value)
  if (!parsed.success || parsed.data.length === 0) {
    throw new GameDomainError("INVALID_TRANSITION", "The game spot-type snapshot is invalid")
  }
  return parsed.data
}

function parseStringArray(value: unknown, field: string): string[] {
  const parsed = z.array(z.string().min(1)).safeParse(value ?? [])
  if (!parsed.success) throw new GameDomainError("INVALID_TRANSITION", `The game ${field} snapshot is invalid`)
  return parsed.data
}

async function loadSpotTypeSnapshots(tx: Tx, spotId: string): Promise<{ snapshots: SpotTypeSnapshot[]; initial: string }> {
  const [spot] = await tx.select({ id: spots.id }).from(spots).where(eq(spots.id, spotId))
  if (!spot) throw new GameDomainError("INVALID_INPUT", "Selected spot does not exist")
  const rows = await tx
    .select({ slug: spotTypeAssignments.typeSlug, name: spotTypes.name, sortOrder: spotTypes.sortOrder })
    .from(spotTypeAssignments)
    .innerJoin(spotTypes, eq(spotTypes.slug, spotTypeAssignments.typeSlug))
    .where(eq(spotTypeAssignments.spotId, spotId))
    .orderBy(asc(spotTypeAssignments.typeSlug))
  if (rows.length === 0) throw new GameDomainError("INVALID_INPUT", "The selected spot has no registered spot types")
  const snapshots = rows.map((row) => ({ slug: row.slug, name: row.name, sortOrder: row.sortOrder }))
  return { snapshots, initial: (snapshots[0] as SpotTypeSnapshot).slug }
}

async function findNearestChallengeSpotRow(
  tx: Tx,
  input: {
    latitude: number
    longitude: number
    disciplineSlug: DisciplineSlug
    spotTypeSlugs: readonly string[]
  },
) {
  const point = sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`
  if (input.spotTypeSlugs.length === 0) return null
  const rows = await tx
    .select({ id: spots.id, location: spots.location })
    .from(spots)
    .where(and(
      sql`ST_DWithin(${spots.location}, ${point}, ${DEFAULT_LOCATION_RADIUS_METERS})`,
      sql`exists (
        select 1
        from ${spotDisciplines}
        where ${spotDisciplines.spotId} = ${spots.id}
          and ${spotDisciplines.disciplineSlug} = ${input.disciplineSlug}
      )`,
      sql`exists (
        select 1
        from ${spotTypeAssignments}
        where ${spotTypeAssignments.spotId} = ${spots.id}
          and ${inArray(spotTypeAssignments.typeSlug, [...input.spotTypeSlugs])}
      )`,
    ))
    .orderBy(sql`ST_Distance(${spots.location}, ${point})`, asc(spots.id))
    .limit(1)
  return rows[0] ?? null
}

function assertInitialTrickSettings(
  catalog: TrickCatalog,
  snapshots: readonly SpotTypeSnapshot[],
  spotType: string | undefined,
  level: TrickLevel | undefined,
  selectedCategories?: readonly string[] | null,
): asserts spotType is string {
  if (!spotType || level === undefined) {
    throw new GameDomainError("INVALID_INPUT", "Trick games require an initial spot type and level")
  }
  if (!snapshots.some((snapshot) => snapshot.slug === spotType)) {
    throw new GameDomainError("INVALID_INPUT", "The initial spot type is not available at the selected spot")
  }
  const normalizedCats = selectedCategories && selectedCategories.length > 0 ? new Set(selectedCategories.map((c) => c.toLowerCase())) : null
  const hasCompatible = catalog.tricks.some((trick) => {
    if (trick.level !== level || !trick.compatibleSpotTypes.includes(spotType)) return false
    if (!normalizedCats) return true
    return trick.categories.some((c) => normalizedCats.has(c.toLowerCase()))
  })
  if (!hasCompatible) {
    throw new GameDomainError("NO_COMPATIBLE_TRICK", `No tricks are available for level ${level} at ${spotType}${normalizedCats ? " with selected categories" : ""}`)
  }
}

function assertCreateGameConfiguration(input: CreateGameInput, gameFormat: GameFormat): void {
  if (gameFormat === "bmx_track_racing") {
    if (input.disciplineSlug !== "bmx") {
      throw new GameDomainError("INVALID_INPUT", "Racing games are only available for BMX")
    }
    if (input.lapCount === undefined) {
      throw new GameDomainError("INVALID_INPUT", "Racing games require a lap count")
    }
    if (input.ruleMode !== undefined || input.spotType !== undefined || input.level !== undefined) {
      throw new GameDomainError("INVALID_INPUT", "Trick-only settings are not available for racing games")
    }
    return
  }
  if (input.lapCount !== undefined || input.ghostMode !== undefined) {
    throw new GameDomainError("INVALID_INPUT", "Lap and ghost settings require racing format")
  }
  if (!input.spotType || input.level === undefined) {
    throw new GameDomainError("INVALID_INPUT", "Trick games require an initial spot type and level")
  }
}

async function loadGameState(tx: Tx, gameId: string): Promise<{ game: typeof gameSessions.$inferSelect; state: GameState; round: typeof gameRounds.$inferSelect }> {
  const [game] = await tx.select().from(gameSessions).where(eq(gameSessions.id, gameId))
  if (!game || !game.currentRoundId) throw new GameDomainError("INVALID_INPUT", "Game state not found")
  const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId))
  const [round] = await tx.select().from(gameRounds).where(eq(gameRounds.id, game.currentRoundId))
  const raceLaps = await tx.select().from(gameRaceLaps).where(eq(gameRaceLaps.gameId, gameId))
  if (!round) throw new GameDomainError("INVALID_INPUT", "Round state not found")
  const attempts = await tx.select().from(gameAttempts).where(eq(gameAttempts.roundId, round.id))
  const requiredResponsePlayerIds = parseStringArray(round.requiredResponsePlayerIds, "response-player")
  const responseAttempts = attempts.filter((attempt) => requiredResponsePlayerIds.includes(attempt.playerId))
  const trick = round.trickSourceId && round.trickNameSnapshot && round.trickDescriptionSnapshot && round.trickLevel
    ? {
        id: round.trickSourceId,
        name: round.trickNameSnapshot,
        description: round.trickDescriptionSnapshot,
        level: round.trickLevel as TrickLevel,
        catalogTrickId: round.catalogTrickId,
        sourceId: round.trickSourceId,
        discipline: (round.trickDisciplineSnapshot ?? game.disciplineSlug) as DisciplineSlug,
        compatibleSpotTypes: parseStringArray(round.trickCompatibilitySnapshot, "trick compatibility"),
        categories: [],
      }
    : null
  const currentRound: Round = {
    id: round.id,
    sequence: round.sequence,
    status: round.status as Round["status"],
    challengerPlayerId: round.challengerPlayerId,
    eligiblePlayerIds: parseStringArray(round.eligiblePlayerIds, "eligible-player"),
    spotType: round.spotType,
    spotTypeSnapshot: parseSpotTypeSnapshots(round.spotTypeSnapshot),
    spotTypeChanged: round.spotTypeChanged,
    spotTypeChangedByPlayerId: round.spotTypeChangedByPlayerId,
    level: (round.trickLevel as TrickLevel | null),
    trick,
    challengerResult: round.challengerResult as Round["challengerResult"],
    requiredResponsePlayerIds,
    attempts: responseAttempts.map((attempt) => ({ playerId: attempt.playerId, result: attempt.result as "landed" | "failed" })),
    failedPlayerIds: responseAttempts.filter((attempt) => attempt.result === "failed").map((attempt) => attempt.playerId),
    challengeOutcome: (round.challengeOutcome as Round["challengeOutcome"]) ?? null,
    leadRetained: round.leadRetained,
    blockedReason: round.blockedReason,
  }
  const state: GameState = {
    id: game.id,
    mode: game.mode as GameMode,
    ruleMode: game.challengeRule as GameState["ruleMode"],
    gameFormat: (game as typeof game & RacingSessionFields).gameFormat as GameFormat,
    trainingVariant: game.trainingVariant as TrainingVariant,
    lapCount: (game as typeof game & RacingSessionFields).lapCount,
    ghostMode: (game as typeof game & RacingSessionFields).ghostMode === "global_best",
     lapTimes: raceLaps.map((lap) => ({
       playerId: lap.playerId,
       lap: lap.lapNumber,
       milliseconds: lap.milliseconds,
     })),
    disciplineSlug: game.disciplineSlug as DisciplineSlug,
    challengeKey: game.challengeKey as GameState["challengeKey"],
    gameName: game.gameName,
    eliminationWord: game.eliminationWord,
    wordLength: game.wordLength as GameState["wordLength"],
    catalogId: game.catalogId,
    status: game.status as GameState["status"],
    createdBy: game.createdBy,
    creatorDisplayName: game.creatorDisplayName,
    players: players.map((player) => ({
      id: player.id,
      userId: player.userId,
      guestToken: player.guestToken,
      displayName: player.displayName,
      letters: player.letters,
      failedAttempts: player.failedAttempts,
      status: player.status as Player["status"],
    })),
    availableSpotTypes: parseSpotTypeSnapshots(game.availableSpotTypes),
    initialSpotType: game.initialSpotType,
    nextSpotType: game.nextSpotType,
    nextLevel: (game.nextLevel as TrickLevel | null),
    selectedCategories: (game.selectedCategories as readonly string[] | null) ?? null,
    pendingCategoryProposal: (() => {
      const cats = game.pendingCategories as readonly string[] | null
      const proposer = game.pendingProposerPlayerId as string | null
      const votes = game.pendingVotes as readonly { playerId: string; vote: "pending" | "accepted" | "rejected" }[] | null
      const created = game.pendingProposalCreatedAt as Date | null
      if (!cats || !proposer || !votes || !created) return null
      return { categories: cats, proposerPlayerId: proposer, votes, createdAt: created.toISOString() }
    })(),
    rotationOrder: parseStringArray(game.rotationOrder, "rotation"),
    rotationIndex: game.rotationIndex,
    currentChallengerPlayerId: game.currentChallengerPlayerId,
    winnerPlayerId: game.winnerPlayerId,
    currentRound,
    roundHistory: [],
    version: game.version,
    spotId: game.spotId,
    scheduledStartAt: game.scheduledStartAt,
    timezone: game.timezone,
    locationRadiusMeters: game.locationRadiusMeters,
    locationMaxAccuracyMeters: game.locationMaxAccuracyMeters,
    locationVerificationTtlSeconds: game.locationVerificationTtlSeconds,
  }
  return { game, state, round }
}

function ensureCurrentRound(state: GameState, input: RoundActionInput) {
  if (state.currentRound?.id !== input.roundId) throw new GameDomainError("INVALID_INPUT", "Round is not current")
  if (state.version !== input.expectedVersion) throw new GameDomainError("STALE_VERSION", "The game state is stale")
}

function usedTrickIdsForGame(tx: Tx, gameId: string) {
  return tx
    // Catalog selection uses source IDs. The legacy trickId column can hold
    // the internal catalog UUID, while trickSourceId is the canonical ID
    // exposed by loadPersistedCatalog.
    .select({ trickId: gameRounds.trickSourceId })
    .from(gameRounds)
    .where(eq(gameRounds.gameId, gameId))
    .then((rows) => rows.flatMap((row) => (row.trickId ? [row.trickId] : [])))
}

function verifiedPlayerIdsForRound(tx: Tx, roundId: string, now: Date) {
  return tx
    .select({ playerId: gameLocationVerifications.playerId })
    .from(gameLocationVerifications)
    .where(and(
      eq(gameLocationVerifications.roundId, roundId),
      eq(gameLocationVerifications.status, "verified"),
      gt(gameLocationVerifications.expiresAt, now),
    ))
    .then((rows) => rows.map((row) => row.playerId))
}

function activePlayerIds(state: GameState): string[] {
  return state.players.filter((player) => player.status === "active").map((player) => player.id)
}

function requireUserIdentity(player: Player): string {
  if (!player.userId) throw new GameDomainError("INVALID_TRANSITION", "A challenge participant requires a user identity")
  return player.userId
}

function persistRoundSetup(tx: Tx, round: Round, levelSelectedByPlayerId: string | null = null, catalogTrickId: string | null = round.trick?.catalogTrickId ?? null) {
  return tx.update(gameRounds).set({
    challengerPlayerId: round.challengerPlayerId,
    spotType: round.spotType,
    spotTypeChanged: round.spotTypeChanged,
    spotTypeChangedByPlayerId: round.spotTypeChangedByPlayerId,
    spotTypeSnapshot: round.spotTypeSnapshot,
    eligiblePlayerIds: round.eligiblePlayerIds,
    trickLevel: round.level,
    trickId: round.trick?.sourceId ?? null,
    trickNameSnapshot: round.trick?.name ?? null,
    trickDescriptionSnapshot: round.trick?.description ?? null,
    catalogTrickId,
    trickSourceId: round.trick?.sourceId ?? null,
    trickDisciplineSnapshot: round.trick?.discipline ?? null,
    trickCompatibilitySnapshot: round.trick?.compatibleSpotTypes ?? null,
    levelSelectedByPlayerId,
    blockedReason: round.blockedReason,
    requiredResponsePlayerIds: round.requiredResponsePlayerIds,
    challengerResult: round.challengerResult,
    challengeOutcome: round.challengeOutcome,
    leadRetained: round.leadRetained,
    status: round.status,
  }).where(eq(gameRounds.id, round.id))
}

function syncSessionFromState(tx: Tx, state: GameState, extra: Partial<typeof gameSessions.$inferInsert> = {}) {
  return tx.update(gameSessions).set({
    status: state.status,
    rotationOrder: state.rotationOrder,
    rotationIndex: state.rotationIndex,
    currentChallengerPlayerId: state.currentChallengerPlayerId,
    currentRoundId: state.currentRound?.id ?? null,
    nextSpotType: state.nextSpotType,
    nextLevel: state.nextLevel,
    selectedCategories: (state as GameState & { selectedCategories?: readonly string[] | null }).selectedCategories ?? null,
    pendingCategories: (state as GameState & { pendingCategoryProposal?: { categories: readonly string[] } | null }).pendingCategoryProposal?.categories ?? null,
    pendingProposerPlayerId: (state as GameState & { pendingCategoryProposal?: { proposerPlayerId: string } | null }).pendingCategoryProposal?.proposerPlayerId ?? null,
    pendingVotes: (state as GameState & { pendingCategoryProposal?: { votes: readonly { playerId: string; vote: string }[] } | null }).pendingCategoryProposal?.votes ?? null,
    pendingProposalCreatedAt: (state as GameState & { pendingCategoryProposal?: { createdAt: string } | null }).pendingCategoryProposal ? new Date((state as GameState & { pendingCategoryProposal: { createdAt: string } }).pendingCategoryProposal.createdAt) : null,
    winnerPlayerId: state.winnerPlayerId,
    trainingVariant: state.trainingVariant,
    version: state.version,
    ...extra,
  }).where(eq(gameSessions.id, state.id))
}

async function insertNextRound(tx: Tx, game: typeof gameSessions.$inferSelect, round: Round, activePlayerIds: readonly string[]) {
  await tx.insert(gameRounds).values({
    id: round.id,
    gameId: game.id,
    sequence: round.sequence,
    challengerPlayerId: round.challengerPlayerId,
    spotType: round.spotType,
    spotTypeChanged: round.spotTypeChanged,
    spotTypeChangedByPlayerId: round.spotTypeChangedByPlayerId,
    spotTypeSnapshot: round.spotTypeSnapshot,
    eligiblePlayerIds: game.mode === "challenge" ? [] : [...activePlayerIds],
    trickLevel: round.level,
    trickId: round.trick?.sourceId ?? null,
    trickSourceId: round.trick?.sourceId ?? null,
    trickNameSnapshot: round.trick?.name ?? null,
    trickDescriptionSnapshot: round.trick?.description ?? null,
    trickDisciplineSnapshot: round.trick?.discipline ?? null,
    trickCompatibilitySnapshot: round.trick?.compatibleSpotTypes ?? null,
    catalogTrickId: round.trick?.catalogTrickId ?? null,
    blockedReason: round.blockedReason,
    challengerResult: round.challengerResult,
    challengeOutcome: round.challengeOutcome,
    leadRetained: round.leadRetained,
    requiredResponsePlayerIds: [],
    status: round.status,
  })
  if (game.mode === "challenge" && game.spotId) {
    await tx.insert(gameLocationVerifications).values(
      activePlayerIds.map((playerId) => ({
        gameId: game.id,
        roundId: round.id,
        playerId,
        spotId: game.spotId as string,
        status: "pending",
      })),
    )
  }
}

type InitialGamePersistenceInput = {
  game: GameState
  player: Player
  initialRoundId: string
  snapshots: SpotTypeSnapshot[]
  challenge: boolean
  catalogId: string
  spotId: string | null
  scheduledStartAt: Date | null
  timezone: string | null
  policy: { maxAccuracy: number; ttlSeconds: number } | null
  identity: Identity
  creatorIpHash: string
  gameFormat?: GameFormat
  lapCount?: number | null
  ghostMode?: boolean
  weather?: {
    forecastIcon: string
    observedIcon: string
    confirmed: boolean
    forecastDescription?: string | null
    forecastTemp?: number | null
    reportedAt: Date
    snapshot?: { icon: string; description: string; temp: number | null; humidity: number | null; wind: number | null } | null
  } | null
}

/**
 * Persists the initial game graph in FK-safe order. game_sessions and
 * game_rounds reference each other, so the session is linked to its first
 * round only after both rows have been inserted.
 */
export async function persistInitialGame(tx: Tx, input: InitialGamePersistenceInput) {
  const {
    game,
    player,
    initialRoundId,
    snapshots,
    challenge,
    catalogId,
    spotId,
    scheduledStartAt,
    timezone,
    policy,
    identity,
    creatorIpHash,
    gameFormat = "tricks",
    lapCount = null,
    ghostMode = false,
  } = input

  const sessionValues = {
    id: game.id,
    shareCode: shareCode(),
    mode: game.mode,
    challengeRule: game.ruleMode,
    gameFormat,
    trainingVariant: game.trainingVariant,
    lapCount,
    ghostMode: ghostMode ? "global_best" : "off",
    disciplineSlug: game.disciplineSlug,
    challengeKey: game.challengeKey,
    gameName: game.gameName,
    eliminationWord: game.eliminationWord,
    wordLength: game.wordLength,
    catalogId,
    spotId,
    scheduledStartAt,
    timezone,
    locationRadiusMeters: spotId ? DEFAULT_LOCATION_RADIUS_METERS : null,
    locationMaxAccuracyMeters: policy?.maxAccuracy ?? null,
    locationVerificationTtlSeconds: policy?.ttlSeconds ?? null,
    weatherForecastIcon: input.weather?.forecastIcon ?? null,
    weatherForecastDescription: input.weather?.forecastDescription ?? null,
    weatherForecastTemp: input.weather?.forecastTemp ?? null,
    weatherObservedIcon: input.weather?.observedIcon ?? null,
    weatherConfirmed: input.weather?.confirmed ?? null,
    weatherReportedAt: input.weather?.reportedAt ?? null,
    weatherForecastSnapshot: input.weather?.snapshot ?? null,
    availableSpotTypes: snapshots,
    initialSpotType: game.initialSpotType,
    nextSpotType: game.nextSpotType,
    nextLevel: game.nextLevel,
    selectedCategories: (game as GameState & { selectedCategories?: readonly string[] | null }).selectedCategories ?? null,
    currentRoundId: null,
    status: "lobby",
    createdBy: identity.userId,
    creatorIpHash,
    creatorDisplayName: identity.name,
    rotationOrder: [],
    version: 0,
  } as typeof gameSessions.$inferInsert & RacingSessionFields
  await tx.insert(gameSessions).values(sessionValues)
  await tx.insert(gamePlayers).values({
    id: player.id,
    gameId: game.id,
    userId: identity.userId,
    guestToken: identity.guestToken,
    displayName: identity.name,
    seatOrder: 0,
  })
  await tx.insert(gameRounds).values({
    id: initialRoundId,
    gameId: game.id,
    sequence: 1,
    spotType: game.nextSpotType,
    spotTypeSnapshot: snapshots,
    eligiblePlayerIds: [],
    trickLevel: game.nextLevel,
    requiredResponsePlayerIds: [],
    status: challenge ? "verifying_location" : "selecting_spot_type",
  })
  await tx.update(gameSessions)
    .set({ currentRoundId: initialRoundId })
    .where(eq(gameSessions.id, game.id))
}

async function refreshRoundVerificationStatus(tx: Tx, gameId: string, roundId: string, now: Date) {
  const [game] = await tx.select({ status: gameSessions.status }).from(gameSessions).where(eq(gameSessions.id, gameId))
  const [round] = await tx.select({
    status: gameRounds.status,
    trickId: gameRounds.trickId,
    trickLevel: gameRounds.trickLevel,
    blockedReason: gameRounds.blockedReason,
  }).from(gameRounds).where(eq(gameRounds.id, roundId))
  if (!round || !["verifying_location", "paused"].includes(round.status)) return
  const active = await tx.select({ id: gamePlayers.id }).from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.status, "active")))
  const verifications = await tx
    .select({ playerId: gameLocationVerifications.playerId, status: gameLocationVerifications.status, expiresAt: gameLocationVerifications.expiresAt })
    .from(gameLocationVerifications)
    .where(eq(gameLocationVerifications.roundId, roundId))
  const activeIds = new Set(active.map((player) => player.id))
  const current = verifications.filter((row) => activeIds.has(row.playerId))
  const verifiedPlayerIds = current
    .filter((row) => row.status === "verified" && row.expiresAt !== null && row.expiresAt > now)
    .map((row) => row.playerId)
  const initialLobbyVerification = game?.status === "lobby"
  if (verifiedPlayerIds.length >= 2 && (!initialLobbyVerification || verifiedPlayerIds.length === active.length)) {
    // Spec 9.4: freeze the eligible snapshot the moment the round leaves
    // verification; expiry after this point never removes a response.
    const nextStatus = round.blockedReason
      ? "no_compatible_trick"
      : round.trickId && round.trickLevel !== null
        ? "challenge_open"
        : "selecting_spot_type"
    await tx.update(gameRounds).set({ status: nextStatus, eligiblePlayerIds: verifiedPlayerIds }).where(eq(gameRounds.id, roundId))
    // Spec 10.3.4: active participants left outside the frozen snapshot are
    // unavailable for this round (they re-verify in a later round).
    const eligible = new Set(verifiedPlayerIds)
    for (const row of current) {
      if (row.status === "pending" && !eligible.has(row.playerId)) {
        await tx.update(gameLocationVerifications).set({ status: "unavailable" }).where(and(
          eq(gameLocationVerifications.roundId, roundId),
          eq(gameLocationVerifications.playerId, row.playerId),
        ))
      }
    }
    return
  }
  const allTerminal = active.length > 0 && current.every((row) => row.status !== "pending")
  if (allTerminal && round.status === "verifying_location") {
    await tx.update(gameRounds).set({ status: "paused" }).where(eq(gameRounds.id, roundId))
  }
}

async function awardScoreEvent(
  tx: Tx,
  event: { userId: string; gameId: string; roundId: string | null; eventType: string; points: number; trickLevel: TrickLevel | null; eventKey: string },
) {
  const [inserted] = await tx.insert(riderScoreEvents).values({ ...event }).onConflictDoNothing({ target: riderScoreEvents.eventKey }).returning({ id: riderScoreEvents.id })
  if (!inserted) return
  await tx.insert(riderStats).values({ userId: event.userId, totalPoints: event.points }).onConflictDoUpdate({
    target: riderStats.userId,
    set: { totalPoints: sql`${riderStats.totalPoints} + ${event.points}`, updatedAt: new Date() },
  })
  // Queued: flushed by withDbWrite after the surrounding transaction commits.
  queueTagRevalidate("ranking:global", LIST_CACHE_LIFE)
  queueTagRevalidate(`ranking:user:${event.userId}`, LIST_CACHE_LIFE)
  queueTagRevalidate(`profile:games:${event.userId}`, PROFILE_CACHE_LIFE)
  queueTagRevalidate(`profile:user:${event.userId}`, PROFILE_CACHE_LIFE)
}

async function incrementRiderStats(
  tx: Tx,
  userId: string,
  delta: { gamesPlayed?: number; gamesWon?: number; tricksLanded?: number; tricksFailed?: number },
) {
  await tx.insert(riderStats).values({ userId, gamesPlayed: delta.gamesPlayed ?? 0, gamesWon: delta.gamesWon ?? 0, tricksLanded: delta.tricksLanded ?? 0, tricksFailed: delta.tricksFailed ?? 0 }).onConflictDoUpdate({
    target: riderStats.userId,
    set: {
      gamesPlayed: sql`${riderStats.gamesPlayed} + ${delta.gamesPlayed ?? 0}`,
      gamesWon: sql`${riderStats.gamesWon} + ${delta.gamesWon ?? 0}`,
      tricksLanded: sql`${riderStats.tricksLanded} + ${delta.tricksLanded ?? 0}`,
      tricksFailed: sql`${riderStats.tricksFailed} + ${delta.tricksFailed ?? 0}`,
      updatedAt: new Date(),
    },
  })
}

async function createCompletedHistory(
  tx: Tx,
  game: typeof gameSessions.$inferSelect,
  winnerPlayerId: string,
  now: Date,
) {
  if (game.mode !== "challenge" || !game.spotId || !game.scheduledStartAt) return
  const rounds = await tx.select({ spotType: gameRounds.spotType }).from(gameRounds).where(eq(gameRounds.gameId, game.id))
  const counts: Record<string, number> = {}
  for (const round of rounds) counts[round.spotType] = (counts[round.spotType] ?? 0) + 1
  const verified = await tx.select({ playerId: gameLocationVerifications.playerId }).from(gameLocationVerifications).where(and(eq(gameLocationVerifications.gameId, game.id), eq(gameLocationVerifications.status, "verified")))
  const players = await tx.select({ id: gamePlayers.id }).from(gamePlayers).where(eq(gamePlayers.gameId, game.id))
  await tx.insert(spotChallengeRecords).values({
    gameId: game.id,
    spotId: game.spotId,
    disciplineSlug: game.disciplineSlug,
    gameName: game.gameName,
    eliminationWord: game.eliminationWord,
    scheduledStartAt: game.scheduledStartAt,
    startedAt: game.startedAt ?? game.updatedAt,
    completedAt: now,
    participantCount: players.length,
    verifiedParticipantCount: new Set(verified.map((row) => row.playerId)).size,
    spotTypesUsed: Object.keys(counts),
    roundCountBySpotType: counts,
    initialSpotType: game.initialSpotType,
    finalSpotType: game.nextSpotType,
    winnerPlayerId,
    status: "completed",
  }).onConflictDoNothing({ target: spotChallengeRecords.gameId })
}

/**
 * Shared spot-resolution + location-verification pipeline for challenge
 * creation and spot-anchored training creation. Finds the nearest compatible
 * registered spot, asserts it matches the client's accepted spot, and runs
 * `verifyLocation` against the configured policy.
 */
async function resolveVerifiedNearbySpot(
  tx: Tx,
  catalog: { tricks: ReadonlyArray<{ compatibleSpotTypes: readonly string[] }> },
  args: {
    latitude: number
    longitude: number
    accuracyMeters: number
    disciplineSlug: DisciplineSlug
    spotId: string
    maxAccuracyMeters: number
    lowAccuracyMessage: string
  },
) {
  const compatibleSpotTypeSlugs = [...new Set(
    catalog.tricks.flatMap((trick) => trick.compatibleSpotTypes),
  )]
  const nearest = await findNearestChallengeSpotRow(tx, {
    latitude: args.latitude,
    longitude: args.longitude,
    disciplineSlug: args.disciplineSlug,
    spotTypeSlugs: compatibleSpotTypeSlugs,
  })
  if (!nearest) {
    throw new GameDomainError(
      "INVALID_INPUT",
      `No compatible registered spot was found within ${DEFAULT_LOCATION_RADIUS_METERS} meters`,
    )
  }
  if (nearest.id !== args.spotId) {
    throw new GameDomainError(
      "INVALID_INPUT",
      "The nearby spot changed. Refresh your location and accept the current spot",
    )
  }
  const locationDecision = verifyLocation(
    {
      latitude: args.latitude,
      longitude: args.longitude,
      accuracyMeters: args.accuracyMeters,
    },
    { latitude: nearest.location.lat, longitude: nearest.location.lon },
    {
      radiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
      maxAccuracyMeters: args.maxAccuracyMeters,
    },
  )
  if (locationDecision.status === "rejected") {
    throw new GameDomainError(
      "INVALID_INPUT",
      locationDecision.reason === "low_accuracy"
        ? args.lowAccuracyMessage
        : `You must be within ${DEFAULT_LOCATION_RADIUS_METERS} meters of a registered spot`,
    )
  }
  return { nearest, locationDecision }
}

export async function createGame(identity: Identity, input: CreateGameInput, context: { ip: string }) {
  const gameFormat = input.gameFormat ?? "tricks"
  assertCreateGameConfiguration(input, gameFormat)
  assertGuestAllowedOnTraining(input.mode, isGuest(identity))
  requireGuestName(identity)
  const { db } = getDbClient()
  return withDbWrite("games.create", () => db.transaction(async (tx) => {
    const ipHash = creatorIpHash(context.ip)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'training-game-ip:' + ipHash}, 0))`)
    if (input.mode === "challenge") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'challenge-game-identity:' + identityActorId(identity)}, 0))`)
    }

    const fingerprint = fingerprintFor(input)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "create_game",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
    })
    if (replay) return replay

    if (input.mode === "training") {
      // Cleanup takes session locks before touching rounds, matching gameplay
      // mutations and preventing lock-order deadlocks.
      await cancelExpiredTrainingGames(tx, trainingGameExpiry(new Date()))

      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(gameSessions)
        .where(and(
          eq(gameSessions.mode, "training"),
          eq(gameSessions.creatorIpHash, ipHash),
          inArray(gameSessions.status, ["lobby", "active"]),
        ))
      if ((countRow?.count ?? 0) >= TRAINING_GAME_LIMIT) {
        throw new GameDomainError("INVALID_TRANSITION", "You can have up to 3 open training games at a time. Finish one or wait 10 minutes for inactive games to expire.")
      }
    } else {
      await cancelExpiredChallengeGames(tx, new Date())

      const [openGame] = await tx
        .select({ id: gameSessions.id })
        .from(gameSessions)
        .leftJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
        .where(and(
          eq(gameSessions.mode, "challenge"),
          inArray(gameSessions.status, ["lobby", "active"]),
          or(
            identity.userId ? eq(gameSessions.createdBy, identity.userId) : eq(gamePlayers.guestToken, identity.guestToken as string),
            identity.userId ? eq(gamePlayers.userId, identity.userId) : eq(gamePlayers.guestToken, identity.guestToken as string),
          ),
        ))
        .limit(1)
      if (openGame) {
        throw new GameDomainError("INVALID_TRANSITION", "You already have an open game. Finish it before starting another one.")
      }
    }
    if (input.expectedVersion !== 0) throw new GameDomainError("STALE_VERSION", "A new game must start at version zero")

    const challenge = input.mode === "challenge"
    const catalogId = await resolveCatalogId(tx, input.disciplineSlug)
    const catalog = await loadPersistedCatalog(tx, catalogId, input.disciplineSlug)

    let snapshots: SpotTypeSnapshot[]
    let initialSpotType: string
    let spotId: string | null = null
    let scheduledStartAt: Date | null = null
    let timezone: string | null = null
    let policy: { maxAccuracy: number; ttlSeconds: number } | null = null
    let initialLevel: TrickLevel | null = null
    let creatorVerification: {
      distanceMeters: number
      accuracyMeters: number
      verifiedAt: Date
      expiresAt: Date
    } | null = null

    // Extract weather payload (present when spot attached)
    const weatherInput = input as {
      weatherForecastIcon?: string
      weatherObservedIcon?: string
      weatherConfirmed?: boolean
      weatherForecastDescription?: string
      weatherForecastTemp?: number
      spotId?: string
      latitude?: number
      longitude?: number
      accuracyMeters?: number
    }
    const rawCategories = (input as { categories?: readonly string[] }).categories ?? []
    const normalizedSelectedCategories = [...new Set(rawCategories.map((c) => String(c).trim().toLowerCase()).filter((c) => c.length>0))].sort()
    const selectedCategories: readonly string[] | null = normalizedSelectedCategories.length > 0 ? normalizedSelectedCategories : null
    // For training, spot presence is optional; for challenge it's already required by zod
    const trainingSpotId = !challenge ? (weatherInput.spotId ?? null) : null

    if (challenge) {
      const now = new Date()
      policy = requireGamePolicy()
      const { locationDecision } = await resolveVerifiedNearbySpot(tx, catalog, {
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        disciplineSlug: input.disciplineSlug,
        spotId: input.spotId,
        maxAccuracyMeters: policy.maxAccuracy,
        lowAccuracyMessage: "Your location accuracy is not sufficient to create a challenge",
      })
      const loaded = await loadSpotTypeSnapshots(tx, input.spotId)
      snapshots = loaded.snapshots
      if (gameFormat === "tricks") {
        assertInitialTrickSettings(catalog, snapshots, input.spotType, input.level, selectedCategories)
        initialSpotType = input.spotType
        initialLevel = input.level as TrickLevel
      } else {
        initialSpotType = loaded.initial
      }
      spotId = input.spotId
      scheduledStartAt = new Date(now.getTime() + input.startDelayMinutes * 60 * 1000)
      timezone = input.timezone
      creatorVerification = {
        distanceMeters: locationDecision.distanceMeters,
        accuracyMeters: locationDecision.accuracyMeters,
        verifiedAt: now,
        expiresAt: new Date(now.getTime() + policy.ttlSeconds * 1000),
      }
    } else if (trainingSpotId) {
      // Signed-in training anchored to a registered spot
      const now = new Date()
      policy = requireGamePolicy()
      const tInput = input as Extract<CreateGameInput, { mode: "training" }> & { spotId: string; latitude: number; longitude: number; accuracyMeters: number }
      const compatibleSpotTypeSlugs = [...new Set(
        catalog.tricks.flatMap((trick) => trick.compatibleSpotTypes),
      )]
      if (compatibleSpotTypeSlugs.length === 0) {
        throw new GameDomainError("INVALID_INPUT", "No spot types are registered for this discipline")
      }
      const { locationDecision } = await resolveVerifiedNearbySpot(tx, catalog, {
        latitude: tInput.latitude,
        longitude: tInput.longitude,
        accuracyMeters: tInput.accuracyMeters,
        disciplineSlug: input.disciplineSlug,
        spotId: tInput.spotId,
        maxAccuracyMeters: policy.maxAccuracy,
        lowAccuracyMessage: "Your location accuracy is not sufficient to attach this spot",
      })
      const loaded = await loadSpotTypeSnapshots(tx, tInput.spotId)
      snapshots = loaded.snapshots
      if (gameFormat === "tricks") {
        assertInitialTrickSettings(catalog, snapshots, input.spotType, input.level, selectedCategories)
        initialSpotType = input.spotType!
        initialLevel = input.level as TrickLevel
      } else {
        initialSpotType = loaded.initial
        initialLevel = null
      }
      spotId = tInput.spotId
      scheduledStartAt = null
      timezone = null
      creatorVerification = {
        distanceMeters: locationDecision.distanceMeters,
        accuracyMeters: locationDecision.accuracyMeters,
        verifiedAt: now,
        expiresAt: new Date(now.getTime() + policy.ttlSeconds * 1000),
      }
    } else {
      const rows = await tx.select({ slug: spotTypes.slug, name: spotTypes.name, sortOrder: spotTypes.sortOrder }).from(spotTypes).orderBy(asc(spotTypes.slug))
      if (rows.length === 0) throw new GameDomainError("INVALID_INPUT", "No spot types are registered")
      snapshots = rows.map((row) => ({ slug: row.slug, name: row.name, sortOrder: row.sortOrder }))
      if (gameFormat === "tricks") {
        assertInitialTrickSettings(catalog, snapshots, input.spotType, input.level, selectedCategories)
        initialSpotType = input.spotType
        initialLevel = input.level as TrickLevel
      } else {
        initialSpotType = (snapshots[0] as SpotTypeSnapshot).slug
      }
    }

    let weatherData: InitialGamePersistenceInput["weather"] = null
    if (spotId) {
      const fIcon = weatherInput.weatherForecastIcon
      const confirmed = weatherInput.weatherConfirmed
      const oIcon = weatherInput.weatherObservedIcon
      if (!fIcon || confirmed === undefined) {
        throw new GameDomainError("INVALID_INPUT", "Weather confirmation is required when a spot is attached")
      }
      if (confirmed === false && !oIcon) {
        throw new GameDomainError("INVALID_INPUT", "Select the correct live weather when the forecast is incorrect")
      }
      const observedIcon = confirmed ? fIcon : (oIcon as string)
      weatherData = {
        forecastIcon: fIcon,
        observedIcon,
        confirmed,
        forecastDescription: weatherInput.weatherForecastDescription ?? null,
        forecastTemp: weatherInput.weatherForecastTemp ?? null,
        reportedAt: new Date(),
        snapshot: {
          icon: fIcon as "sunny",
          description: weatherInput.weatherForecastDescription ?? "",
          temp: weatherInput.weatherForecastTemp ?? null,
          humidity: null,
          wind: null,
        },
      }
    }

    const game = createLobby({
      id: crypto.randomUUID(),
      mode: input.mode,
      ruleMode: input.ruleMode ?? "flexible",
      gameFormat,
      disciplineSlug: input.disciplineSlug,
      createdBy: identityActorId(identity),
      creatorDisplayName: identity.name,
      players: [{ id: crypto.randomUUID(), userId: identity.userId, guestToken: identity.guestToken, displayName: identity.name, letters: "", failedAttempts: 0, status: "active" }],
      availableSpotTypes: snapshots,
      initialSpotType,
      initialLevel,
      selectedCategories,
      definition: GAME_DEFINITIONS[input.disciplineSlug],
      catalog,
      catalogId,
    })
    const player = game.players[0] as Player
    const initialRoundId = crypto.randomUUID()
    await persistInitialGame(tx, {
      game,
      player,
      initialRoundId,
      snapshots,
      challenge,
      catalogId,
      spotId,
      scheduledStartAt,
      timezone,
      policy,
      identity,
      creatorIpHash: ipHash,
      gameFormat,
      lapCount: input.lapCount ?? null,
      ghostMode: input.ghostMode ?? false,
      weather: weatherData,
    })
    if (spotId && creatorVerification) {
      await tx.insert(gameLocationVerifications).values({
        gameId: game.id,
        roundId: initialRoundId,
        playerId: player.id,
        spotId,
        verifiedAt: creatorVerification.verifiedAt,
        distanceMeters: creatorVerification.distanceMeters,
        accuracyMeters: creatorVerification.accuracyMeters,
        status: "verified",
        expiresAt: creatorVerification.expiresAt,
      })
    }
    if (spotId && weatherData) {
      const { spotWeatherReports } = await import("@/db/schema")
      await tx.insert(spotWeatherReports).values({
        spotId,
        gameId: game.id,
        reporterId: identity.userId,
        forecastIcon: weatherData.forecastIcon,
        observedIcon: weatherData.observedIcon,
        confirmed: weatherData.confirmed,
        forecastSnapshot: weatherData.snapshot as { icon: "sunny" | "partly_cloudy_day" | "cloudy" | "rain" | "snow"; description: string; temp: number | null; humidity: number | null; wind: number | null } | null,
      })
      // Queued: flushed by withDbWrite after the surrounding transaction commits.
      queueTagRevalidate(`spot-weather:${spotId}`, REPORT_CACHE_LIFE)
    }
    // Phase 6: record spot activity — auto-verify spot for authenticated creator
    // so the spot appears in Profile visited/verified and activity board.
    // visited is derived (verified ∪ game spot), so verified insert covers both.
    if (spotId && identity.userId) {
      await tx.insert(verifiedSpots).values({ userId: identity.userId, spotId }).onConflictDoNothing()
    }
    // Revalidate profile + verified caches so fresh visited/verified counts surface immediately
    if (spotId && identity.userId) {
      // Queued: flushed by withDbWrite after the surrounding transaction commits.
      queueTagRevalidate(`profile:user:${identity.userId}`, PROFILE_CACHE_LIFE)
      queueTagRevalidate(`profile:spots:${identity.userId}`, PROFILE_CACHE_LIFE)
      queueTagRevalidate(`verified-spots:user:${identity.userId}`, VERIFIED_CACHE_LIFE)
      queueTagRevalidate(`verified-spots:spot:${spotId}`, VERIFIED_CACHE_LIFE)
    }
    const response = { id: game.id, version: game.version }
    await recordGameMutation(tx, {
      gameId: game.id,
      identity,
      action: "create_game",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: game.version,
      response,
      status: game.status,
    })
    return response
  }))
}

export async function joinGame(identity: Identity, gameId: string, input: MutationInput & { shareCode: string }) {
  requireGuestName(identity)
  const { db } = getDbClient()
  return withDbWrite("games.join", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, shareCode: input.shareCode, expectedVersion: input.expectedVersion })
    const game = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "join_game",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      gameId,
    })
    if (replay) return replay
    assertGuestAllowedOnTraining(game.mode, isGuest(identity))
    if (game.shareCode !== input.shareCode) {
      throw new GameDomainError("INVALID_INPUT", "The share code does not match this game")
    }
    if (input.expectedVersion !== game.version) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    if (game.status !== "lobby") throw new GameDomainError("INVALID_TRANSITION", "Only lobby games can be joined")
    const existing = await tx.select().from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), identityWhereClause(identity)))
    if (existing.length > 0) throw new GameDomainError("INVALID_INPUT", "User already joined this game")
    const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId))
    const activePlayers = players.filter((player) => player.status === "active")
    if (activePlayers.length >= PLAYER_LIMITS.max) throw new GameDomainError("INVALID_INPUT", "The game is full")
    const [joinedPlayer] = await tx.insert(gamePlayers).values({
      gameId,
      userId: identity.userId,
      guestToken: identity.guestToken,
      displayName: identity.name,
      seatOrder: players.length,
    }).returning({ id: gamePlayers.id })
    if (!game.currentRoundId) throw new GameDomainError("INVALID_TRANSITION", "Game is missing its first round")
    if (!joinedPlayer) throw new GameDomainError("INVALID_TRANSITION", "Player could not be added")
    if (game.mode === "challenge" && game.spotId) {
      await tx.insert(gameLocationVerifications).values({
        gameId,
        roundId: game.currentRoundId,
        playerId: joinedPlayer.id,
        spotId: game.spotId,
        status: "pending",
      })
    }
    const version = game.version + 1
    await tx.update(gameSessions).set({ version, updatedAt: new Date() }).where(eq(gameSessions.id, gameId))
    const response = { id: gameId, version }
    await recordGameMutation(tx, {
      gameId,
      identity,
      action: "join_game",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: version,
      response,
      status: game.status,
    })
    return response
  }))
}

async function startGameMutation(
  identity: Identity,
  gameId: string,
  input: StartGameInput,
  variant: "multiplayer" | "solo",
  now = new Date(),
) {
  const { db } = getDbClient()
  return withDbWrite("games.start", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({
      gameId,
      expectedVersion: input.expectedVersion,
      startNow: input.startNow ?? false,
    })
    const action = variant === "solo" ? "train_alone" : "start_game"
    const game = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action, idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) {
      log.info("game.start.replay", {
        gameId,
        actorType: identity.userId ? "user" : "guest",
      })
      return replay
    }
    assertGuestAllowedOnTraining(game.mode, isGuest(identity))
    const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId))
    const activePlayers = players.filter((player) => player.status === "active")
    const gameFormat = (game as typeof game & RacingSessionFields).gameFormat as GameFormat
    log.info("game.start.request", {
      gameId,
     mode: game.mode,
     gameFormat: (game as typeof game & RacingSessionFields).gameFormat as GameFormat,
     lapCount: (game as typeof game & RacingSessionFields).lapCount,
     ghostMode: (game as typeof game & RacingSessionFields).ghostMode === "global_best",
      status: game.status,
      expectedVersion: input.expectedVersion,
      actualVersion: game.version,
      actorType: identity.userId ? "user" : "guest",
      playerCount: players.length,
      activePlayerCount: activePlayers.length,
    })
    if (input.expectedVersion !== game.version) {
      log.warn("game.start.rejected", { gameId, reason: "stale_version", expectedVersion: input.expectedVersion, actualVersion: game.version, status: game.status })
      throw new GameDomainError("STALE_VERSION", "The game state is stale")
    }
    const [actorPlayer] = identity.userId
      ? players.filter((player) => player.userId === identity.userId).map((player) => ({ seatOrder: player.seatOrder })).slice(0, 1)
      : players.filter((player) => player.guestToken === identity.guestToken).map((player) => ({ seatOrder: player.seatOrder })).slice(0, 1)
    const actorIsCreator = identity.userId
      ? game.createdBy === identity.userId
      : actorPlayer?.seatOrder === 0
    if (!actorIsCreator) {
      log.warn("game.start.rejected", { gameId, reason: "not_creator", status: game.status, expectedVersion: input.expectedVersion, actualVersion: game.version })
      throw new GameDomainError("NOT_AUTHORIZED", "Only the creator can start the game")
    }
    if (game.status === "active" && (variant === "solo" || game.trainingVariant === "solo")) {
      throw new GameDomainError("INVALID_TRANSITION", "This game has already started")
    }
    if (game.status === "active") {
      if (!game.currentRoundId) {
        log.warn("game.start.rejected", { gameId, reason: "active_missing_current_round", status: game.status, expectedVersion: input.expectedVersion, actualVersion: game.version })
        throw new GameDomainError("INVALID_TRANSITION", "The active game is missing its current round")
      }
      log.info("game.start.already_active", {
        gameId,
        mode: game.mode,
        version: game.version,
        activePlayerCount: activePlayers.length,
      })
      const response = gameMutationResponseSchema.parse({
        id: gameId,
        version: game.version,
        status: game.status,
      })
      await recordGameAction(tx, { gameId, identity, action, idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: game.version, response })
      return response
    }
    if (game.status !== "lobby") {
      log.warn("game.start.rejected", { gameId, reason: "closed_game", status: game.status, expectedVersion: input.expectedVersion, actualVersion: game.version })
      throw new GameDomainError("INVALID_TRANSITION", "This game is already closed")
    }
    if (!game.currentRoundId) {
      log.warn("game.start.rejected", { gameId, reason: "missing_current_round", status: game.status, expectedVersion: input.expectedVersion, actualVersion: game.version })
      throw new GameDomainError("INVALID_TRANSITION", "Game is missing its first round")
    }
    if (variant === "solo") {
      if (game.mode !== "training") throw new GameDomainError("INVALID_TRANSITION", "Train Alone is only available in training games")
      if (gameFormat === "bmx_track_racing") throw new GameDomainError("INVALID_TRANSITION", "Train Alone is only available for trick games")
      if (game.trainingVariant !== "multiplayer") throw new GameDomainError("INVALID_TRANSITION", "This game has already started training alone")
      if (activePlayers.length !== 1) throw new GameDomainError("INVALID_INPUT", "Train Alone requires exactly one active rider")
    } else if (game.trainingVariant === "solo") {
      throw new GameDomainError("INVALID_TRANSITION", "Solo training must be continued from the active game")
    }

    const catalog = await loadPersistedCatalog(tx, game.catalogId, game.disciplineSlug as DisciplineSlug)
    const creatorPlayer = players.find((player) => player.seatOrder === 0)
    const verifiedIds = game.mode === "challenge"
      ? await verifiedPlayerIdsForRound(tx, game.currentRoundId, now)
      : players.filter((player) => player.status === "active").map((player) => player.id)
    const lobbySnapshot = createLobby({
      id: game.id,
      mode: game.mode as GameMode,
      ruleMode: game.challengeRule as GameState["ruleMode"],
      gameFormat,
      trainingVariant: game.trainingVariant as TrainingVariant,
      disciplineSlug: game.disciplineSlug as DisciplineSlug,
      createdBy: creatorPlayer?.guestToken ?? game.createdBy ?? "",
      creatorDisplayName: game.creatorDisplayName,
      players: players.map((player) => ({ id: player.id, userId: player.userId, guestToken: player.guestToken, displayName: player.displayName, letters: player.letters, failedAttempts: player.failedAttempts, status: player.status as Player["status"] })),
      availableSpotTypes: (game.availableSpotTypes as SpotTypeSnapshot[]) ?? [],
      initialSpotType: game.initialSpotType,
      initialLevel: game.nextLevel as TrickLevel | null,
      definition: GAME_DEFINITIONS[game.disciplineSlug as DisciplineSlug],
      catalog,
      catalogId: game.catalogId,
    })
    // Rehydrating through createLobby supplies the domain defaults, but the
    // database version is authoritative for optimistic concurrency.
    const lobby = { ...lobbySnapshot, version: game.version }
    const engineOptions = {
      idFactory: () => game.currentRoundId as string,
      usedTrickIds: await usedTrickIdsForGame(tx, gameId),
      catalog,
    }
    const started = variant === "solo"
      ? startSoloTrainingEngine(lobby, { actorUserId: identityActorId(identity) }, engineOptions)
      : startGameEngine(lobby, {
          actorUserId: identityActorId(identity),
          verifiedPlayerIds: verifiedIds,
          scheduledStartAt: game.scheduledStartAt,
          now,
          allowEarlyStart: input.startNow ?? false,
        }, engineOptions)
    const round = started.currentRound
    if (!round) throw new GameDomainError("INVALID_TRANSITION", "Game start did not create a round")
    const catalogTrickId = round.trick
      ? await catalogTrickIdForSource(tx, game.catalogId, round.trick.sourceId)
      : null
    await persistRoundSetup(tx, round, null, catalogTrickId)
    await syncSessionFromState(tx, started, { startedAt: now, updatedAt: now })
    log.info("game.start.completed", {
      gameId,
      mode: game.mode,
      fromVersion: game.version,
      toVersion: started.version,
      activePlayerCount: activePlayers.length,
    })
    const response = { id: gameId, version: started.version, status: started.status }
    await recordGameMutation(tx, { gameId, identity, action, idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: started.version, response, status: started.status })
    return response
  }))
}

export function startGame(identity: Identity, gameId: string, input: StartGameInput, now = new Date()) {
  return startGameMutation(identity, gameId, input, "multiplayer", now)
}

export function startSoloTraining(identity: Identity, gameId: string, input: MutationInput, now = new Date()) {
  return startGameMutation(identity, gameId, input, "solo", now)
}

export async function verifyGameLocation(identity: Identity, gameId: string, roundId: string, input: MutationInput & { latitude: number; longitude: number; accuracyMeters: number }, now = new Date()) {
  const location = locationInputSchema.safeParse({ latitude: input.latitude, longitude: input.longitude, accuracyMeters: input.accuracyMeters })
  if (!location.success) throw new GameDomainError("INVALID_INPUT", "Invalid location payload")
  const { db } = getDbClient()
  return withDbWrite("games.verify_location", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, roundId, expectedVersion: input.expectedVersion, latitude: input.latitude, longitude: input.longitude, accuracyMeters: input.accuracyMeters })
    const game = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "verify_location", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    if (game.status !== "lobby" && game.status !== "active") {
      throw new GameDomainError("INVALID_TRANSITION", "A closed game rejects all new mutations")
    }
    if (input.expectedVersion !== game.version) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    if (game.mode !== "challenge") throw new GameDomainError("INVALID_TRANSITION", "Location verification is only available in challenge games")
    assertGuestAllowedOnTraining(game.mode, isGuest(identity))
    if (!game.spotId || !game.locationVerificationTtlSeconds) throw new GameDomainError("INVALID_TRANSITION", "Challenge game is missing its location policy")
    if (game.currentRoundId !== roundId) throw new GameDomainError("INVALID_INPUT", "Round not found")
    const [round] = await tx.select({ status: gameRounds.status }).from(gameRounds).where(eq(gameRounds.id, roundId))
    if (!round || !["verifying_location", "paused"].includes(round.status)) {
      throw new GameDomainError("INVALID_TRANSITION", "Location cannot be verified in this round state")
    }
    const [player] = await tx.select().from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), identityWhereClause(identity)))
    if (!player || player.status !== "active") throw new GameDomainError("NOT_AUTHORIZED", "Only an active participant can verify location")
    const [spot] = await tx.select({ location: spots.location }).from(spots).where(eq(spots.id, game.spotId))
    if (!spot) throw new GameDomainError("INVALID_INPUT", "Selected spot does not exist")
    const decision = verifyLocation(location.data, { latitude: spot.location.lat, longitude: spot.location.lon }, { radiusMeters: game.locationRadiusMeters ?? DEFAULT_LOCATION_RADIUS_METERS, maxAccuracyMeters: game.locationMaxAccuracyMeters ?? 0 })
    const expiresAt = decision.status === "verified" ? new Date(now.getTime() + game.locationVerificationTtlSeconds * 1000) : null
    const updated = await tx.update(gameLocationVerifications).set({
      status: decision.status,
      rejectionReason: decision.status === "rejected" ? decision.reason : null,
      distanceMeters: decision.distanceMeters,
      accuracyMeters: decision.accuracyMeters,
      verifiedAt: decision.status === "verified" ? now : null,
      expiresAt,
    }).where(and(eq(gameLocationVerifications.roundId, roundId), eq(gameLocationVerifications.playerId, player.id))).returning({ id: gameLocationVerifications.id })
    if (updated.length === 0) throw new GameDomainError("INVALID_TRANSITION", "No verification record exists for this participant")
    await refreshRoundVerificationStatus(tx, gameId, roundId, now)
    const version = game.version + 1
    await tx.update(gameSessions).set({ version, updatedAt: now }).where(eq(gameSessions.id, gameId))
    const response = { id: gameId, version, status: decision.status, reason: decision.status === "rejected" ? decision.reason : null }
    await recordGameMutation(tx, { gameId, identity, action: "verify_location", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: version, response, status: game.status })
    return response
  }))
}

export async function selectGameSpotType(identity: Identity, gameId: string, input: RoundActionInput & { spotType: string }) {
  const { db } = getDbClient()
  return withDbWrite("games.select_spot_type", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, roundId: input.roundId, expectedVersion: input.expectedVersion, spotType: input.spotType })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "select_spot_type", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    assertActiveGame(locked)
    const aggregate = await loadGameState(tx, gameId)
    ensureCurrentRound(aggregate.state, input)
    const round = aggregate.state.currentRound
    if (!round) throw new GameDomainError("INVALID_TRANSITION", "Spot type cannot be changed now")

    if (round.status === "selecting_spot_type" || round.status === "no_compatible_trick") {
       const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
       const next = selectSpotTypeEngine(aggregate.state, identity, input.spotType, catalog)
      const nextRound = next.currentRound
      if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "Spot type selection did not update the round")
       await persistRoundSetup(tx, nextRound)
       await syncSessionFromState(tx, next, { updatedAt: new Date() })
       const response = { id: gameId, version: next.version }
       await recordGameMutation(tx, { gameId, identity, action: "select_spot_type", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: next.version, response, status: next.status })
      return response
    }

    if (round.status === "challenge_open" || round.status === "collecting_results") {
       if (aggregate.state.ruleMode !== "flexible") {
         throw new GameDomainError("INVALID_TRANSITION", "Strict challenges keep the current line until the round resolves")
       }
       const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
       const used = await usedTrickIdsForGame(tx, gameId)
      const next = selectSpotTypeEngine(aggregate.state, identity, input.spotType, catalog, used)
       const catalogTrickId = next.currentRound?.trick ? await catalogTrickIdForSource(tx, locked.catalogId, next.currentRound.trick.sourceId) : null
       await persistRoundSetup(tx, next.currentRound as Round, null, catalogTrickId)
       await syncSessionFromState(tx, next, { updatedAt: new Date() })
       const response = { id: gameId, version: next.version }
       await recordGameMutation(tx, { gameId, identity, action: "select_spot_type", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: response.version, response, status: next.status })
      return response
    }

    throw new GameDomainError("INVALID_TRANSITION", "Spot type cannot be changed now")
  }))
}

export async function selectGameLevel(identity: Identity, gameId: string, input: RoundActionInput & { level: TrickLevel }) {
  const { db } = getDbClient()
  return withDbWrite("games.select_level", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, roundId: input.roundId, expectedVersion: input.expectedVersion, level: input.level })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "select_level", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    assertActiveGame(locked)
    const aggregate = await loadGameState(tx, gameId)
    ensureCurrentRound(aggregate.state, input)
    const round = aggregate.state.currentRound
    if (!round) throw new GameDomainError("INVALID_TRANSITION", "Level cannot be changed now")

    if (round.status === "selecting_level" || round.status === "no_compatible_trick") {
       const used = await usedTrickIdsForGame(tx, gameId)
       const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
       const next = selectLevelEngine(aggregate.state, identity, input.level, used, catalog)
      const nextRound = next.currentRound
      if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "Level selection did not update the round")
      const selector = aggregate.state.players.find((player) => identityMatches(identity, player))?.id ?? null
      const catalogTrickId = nextRound.trick
        ? await catalogTrickIdForSource(tx, locked.catalogId, nextRound.trick.sourceId)
        : null
       await persistRoundSetup(tx, nextRound, selector, catalogTrickId)
       await syncSessionFromState(tx, next, { updatedAt: new Date() })
       const response = { id: gameId, version: next.version, trickId: nextRound.trick?.sourceId ?? null }
       await recordGameMutation(tx, { gameId, identity, action: "select_level", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: next.version, response, status: next.status })
      return response
    }

    if (round.status === "challenge_open" || round.status === "collecting_results") {
      if (aggregate.state.ruleMode !== "flexible") {
        throw new GameDomainError("INVALID_TRANSITION", "Strict challenges keep the current line until the round resolves")
      }
      const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
      const used = await usedTrickIdsForGame(tx, gameId)
      const next = selectLevelEngine(aggregate.state, identity, input.level, used, catalog)
      const selector = aggregate.state.players.find((player) => identityMatches(identity, player))?.id ?? null
      const catalogTrickId = next.currentRound?.trick ? await catalogTrickIdForSource(tx, locked.catalogId, next.currentRound.trick.sourceId) : null
       await persistRoundSetup(tx, next.currentRound as Round, selector, catalogTrickId)
       await syncSessionFromState(tx, next, { updatedAt: new Date() })
       const response = { id: gameId, version: next.version }
       await recordGameMutation(tx, { gameId, identity, action: "select_level", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: response.version, response, status: next.status })
      return response
    }

    throw new GameDomainError("INVALID_TRANSITION", "Level cannot be changed now")
  }))
}

export async function submitGameChallengerResult(identity: Identity, gameId: string, input: RoundActionInput & { result: "landed" | "failed" }) {
  const { db } = getDbClient()
  return withDbWrite("games.challenger_result", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, roundId: input.roundId, expectedVersion: input.expectedVersion, result: input.result })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "challenger_result", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    assertActiveGame(locked)
    const aggregate = await loadGameState(tx, gameId)
    ensureCurrentRound(aggregate.state, input)
    const now = new Date()
    const nextOptions = aggregate.state.trainingVariant === "solo" || input.result === "failed"
      ? {
          usedTrickIds: await usedTrickIdsForGame(tx, gameId),
          catalog: await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug),
        }
      : undefined
    const next = submitChallengerResultEngine(aggregate.state, identity, input.result, nextOptions)
    const challenger = aggregate.state.players.find((player) => player.id === aggregate.state.currentRound?.challengerPlayerId)
    if (!challenger) throw new GameDomainError("INVALID_TRANSITION", "The round has no challenger")
    await tx.insert(gameAttempts).values({ roundId: input.roundId, playerId: challenger.id, result: input.result })
    if (locked.mode === "challenge" && input.result === "failed") {
      const userId = requireUserIdentity(challenger)
      await incrementRiderStats(tx, userId, { tricksFailed: 1 })
    }
    if (aggregate.state.trainingVariant === "solo") {
      const nextRound = next.currentRound
      if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "Next solo round was not created")
      await tx.update(gameRounds).set({
        challengerResult: input.result,
        challengeOutcome: input.result === "landed" ? "resolved" : "failed_to_establish",
        status: "resolved",
        requiredResponsePlayerIds: [],
        leadRetained: true,
        challengerAttemptedAt: now,
        resolvedAt: now,
      }).where(eq(gameRounds.id, input.roundId))
      await insertNextRound(tx, locked, nextRound, activePlayerIds(next))
      await syncSessionFromState(tx, next, { updatedAt: now })
    } else if (input.result === "landed") {
      const nextRound = next.currentRound
      if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "The round was not updated")
      await tx.update(gameRounds).set({
        challengerResult: "landed",
        challengeOutcome: "established",
        status: "collecting_results",
        challengerAttemptedAt: now,
        requiredResponsePlayerIds: nextRound.requiredResponsePlayerIds,
      }).where(eq(gameRounds.id, input.roundId))
      await syncSessionFromState(tx, next, { updatedAt: now })
    } else {
      const nextRound = next.currentRound
      if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "Next round was not created")
      await tx.update(gameRounds).set({
        challengerResult: "failed",
        challengeOutcome: "failed_to_establish",
        status: "resolved",
        challengerAttemptedAt: now,
        resolvedAt: now,
      }).where(eq(gameRounds.id, input.roundId))
      await insertNextRound(tx, locked, nextRound, activePlayerIds(next))
      await syncSessionFromState(tx, next, { updatedAt: now })
    }
    const response = { id: gameId, version: next.version }
    await recordGameMutation(tx, { gameId, identity, action: "challenger_result", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: next.version, response, status: next.status })
    return response
  }))
}

export async function retrieveAlternativeTrick(
  identity: Identity,
  gameId: string,
  input: RoundActionInput & { excludedTrickIds: readonly string[] },
) {
  const { db } = getDbClient()
  return withDbWrite("games.alternative_trick", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({
      gameId,
      roundId: input.roundId,
      expectedVersion: input.expectedVersion,
      excludedTrickIds: [...input.excludedTrickIds].sort(),
    })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "alternative_trick",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      gameId,
    })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    assertActiveGame(locked)
    const aggregate = await loadGameState(tx, gameId)
    ensureCurrentRound(aggregate.state, input)
    const round = aggregate.state.currentRound
    if (!round || !["challenge_open", "collecting_results"].includes(round.status)) {
      throw new GameDomainError("INVALID_TRANSITION", "An alternative trick is not available for the current round")
    }
    if (aggregate.state.ruleMode !== "flexible") {
      throw new GameDomainError("INVALID_TRANSITION", "Strict challenges must resolve the current trick first")
    }
    const leader = aggregate.state.players.find((player) => player.id === round.challengerPlayerId)
    if (!leader || !identityMatches(identity, leader)) {
      throw new GameDomainError("NOT_AUTHORIZED", "Only the current leader can retrieve an alternative trick")
    }
    if (!round.trick || round.level === null) {
      throw new GameDomainError("INVALID_TRANSITION", "The current challenge has no trick to replace")
    }
    // Per-leader per-round limit: 3 switches. Client sends current + previous alternatives.
    const dedupedInput = [...new Set(input.excludedTrickIds)]
    const excludedTrickIds = [...new Set([round.trick.sourceId, ...dedupedInput])]
    const alternativeCount = excludedTrickIds.length - 1
    if (alternativeCount > 3) {
      throw new GameDomainError("INVALID_TRANSITION", "No more switches left for this round")
    }
    if (alternativeCount >= 3 && excludedTrickIds.includes(round.trick.sourceId)) {
      // Already at limit, the next call would exceed
      // The check above already covers exceeding, but keep explicit message for exact limit
    }
    const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
    const trick = selectAlternativeTrickForSpotType(
      catalog,
      round.spotType,
      round.level,
      excludedTrickIds,
      aggregate.state.selectedCategories ?? null,
      gameId,
    )
    const catalogTrickId = await catalogTrickIdForSource(tx, locked.catalogId, trick.sourceId)
    const updatedRound: Round = {
      ...round,
      trick: {
        ...trick,
        catalogTrickId,
        sourceId: trick.sourceId,
      },
    }
    const nextVersion = aggregate.state.version + 1
    const now = new Date()
    await persistRoundSetup(tx, updatedRound, null, catalogTrickId)
    await tx.update(gameSessions).set({ version: nextVersion, updatedAt: now }).where(eq(gameSessions.id, gameId))
    const response = {
      id: gameId,
      version: nextVersion,
      trickId: trick.sourceId,
      trick: {
        id: trick.sourceId,
        name: trick.name,
        description: trick.description,
        level: trick.level,
        discipline: trick.discipline,
        compatibleSpotTypes: [...trick.compatibleSpotTypes],
        categories: [...(trick.categories ?? [])],
      },
    }
    await recordGameMutation(tx, {
      gameId,
      identity,
      action: "alternative_trick",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: nextVersion,
      response,
      status: locked.status,
    })
    return response
  }))
}

export async function selectGameChallengeSettings(
  identity: Identity,
  gameId: string,
  input: RoundActionInput & { spotType: string; level: TrickLevel },
) {
  const { db } = getDbClient()
  return withDbWrite("games.challenge_settings", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({
      gameId,
      roundId: input.roundId,
      expectedVersion: input.expectedVersion,
      spotType: input.spotType,
      level: input.level,
    })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "challenge_settings",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      gameId,
    })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    assertActiveGame(locked)

    const aggregate = await loadGameState(tx, gameId)
    ensureCurrentRound(aggregate.state, input)
    const used = await usedTrickIdsForGame(tx, gameId)
    const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
    const next = selectChallengeSettingsEngine(
      aggregate.state,
      identity,
      input.spotType,
      input.level,
      used,
      catalog,
    )
    const nextRound = next.currentRound
    if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "Challenge settings did not update the round")

    const catalogTrickId = nextRound.trick
      ? await catalogTrickIdForSource(tx, locked.catalogId, nextRound.trick.sourceId)
      : null
    await persistRoundSetup(tx, nextRound, null, catalogTrickId)
    await syncSessionFromState(tx, next, { updatedAt: new Date() })
    const response = {
      id: gameId,
      version: next.version,
      trickId: nextRound.trick?.sourceId ?? null,
    }
    await recordGameMutation(tx, {
      gameId,
      identity,
      action: "challenge_settings",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: next.version,
      response,
      status: next.status,
    })
    return response
  }))
}

export async function submitGameResponse(identity: Identity, gameId: string, input: RoundActionInput & { result: "landed" | "failed" }) {
  const { db } = getDbClient()
  return withDbWrite("games.response_result", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, roundId: input.roundId, expectedVersion: input.expectedVersion, result: input.result })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "response_result", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    assertActiveGame(locked)
    if (locked.trainingVariant === "solo") {
      throw new GameDomainError("INVALID_TRANSITION", "Solo training does not collect rider responses")
    }
    const aggregate = await loadGameState(tx, gameId)
    ensureCurrentRound(aggregate.state, input)
    const now = new Date()
    const next = submitResponseEngine(aggregate.state, identity, input.result)
    const player = next.players.find((candidate) => identityMatches(identity, candidate))
    if (!player) throw new GameDomainError("PLAYER_NOT_ELIGIBLE", "Player cannot respond")
    await tx.insert(gameAttempts).values({ roundId: input.roundId, playerId: player.id, result: input.result })

    const nextRound = next.currentRound
    if (nextRound?.status === "resolved" || next.status === "complete") {
      if (!nextRound) throw new GameDomainError("INVALID_TRANSITION", "Completed game has no resolved round")
      const level = aggregate.state.currentRound?.level
      if (!level) throw new GameDomainError("INVALID_TRANSITION", "Resolved round has no level")
      const challenge = locked.mode === "challenge"
      if (challenge) {
        const points = LEVEL_POINTS[level]
        const challenger = next.players.find((candidate) => candidate.id === aggregate.state.currentRound?.challengerPlayerId)
        if (!challenger) throw new GameDomainError("INVALID_TRANSITION", "Resolved round has no challenger")
        await awardScoreEvent(tx, { userId: requireUserIdentity(challenger), gameId, roundId: input.roundId, eventType: "challenger_landed", points, trickLevel: level, eventKey: `game:${gameId}:round:${input.roundId}:challenger_landed` })
        await incrementRiderStats(tx, requireUserIdentity(challenger), { tricksLanded: 1 })
        for (const attempt of nextRound.attempts) {
          const attemptPlayer = next.players.find((candidate) => candidate.id === attempt.playerId)
          if (!attemptPlayer) continue
          if (attempt.result === "landed") {
            await awardScoreEvent(tx, { userId: requireUserIdentity(attemptPlayer), gameId, roundId: input.roundId, eventType: "response_landed", points, trickLevel: level, eventKey: `game:${gameId}:round:${input.roundId}:response:${attempt.playerId}:landed` })
            await incrementRiderStats(tx, requireUserIdentity(attemptPlayer), { tricksLanded: 1 })
          } else {
            await incrementRiderStats(tx, requireUserIdentity(attemptPlayer), { tricksFailed: 1 })
          }
        }
      }
      await tx.update(gameRounds).set({ status: "resolved", challengeOutcome: "resolved", leadRetained: true, resolvedAt: now }).where(eq(gameRounds.id, input.roundId))
      for (const candidate of next.players) {
        await tx.update(gamePlayers).set({ letters: candidate.letters, failedAttempts: candidate.failedAttempts, status: candidate.status }).where(eq(gamePlayers.id, candidate.id))
      }
      if (next.status === "complete") {
        const winner = next.players.find((candidate) => candidate.status === "active")
        if (!winner) throw new GameDomainError("INVALID_TRANSITION", "Completed game has no winner")
        if (challenge) {
          await awardScoreEvent(tx, { userId: requireUserIdentity(winner), gameId, roundId: null, eventType: "winner_bonus", points: WINNER_BONUS_POINTS, trickLevel: null, eventKey: `game:${gameId}:winner_bonus` })
          for (const candidate of next.players) {
            if (candidate.status !== "left") await incrementRiderStats(tx, requireUserIdentity(candidate), { gamesPlayed: 1, gamesWon: candidate.id === winner.id ? 1 : 0 })
          }
          await createCompletedHistory(tx, locked, winner.id, now)
        }
        await tx.update(gameSessions).set({ status: "complete", winnerPlayerId: winner.id, completedAt: now, version: next.version, updatedAt: now }).where(eq(gameSessions.id, gameId))
      } else {
        const activeIds = activePlayerIds(next)
        const used = await usedTrickIdsForGame(tx, gameId)
        const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
        const prepared = prepareNextRound(next, {
          bumpVersion: false,
          usedTrickIds: used,
          catalog,
        })
        const preparedRound = prepared.currentRound
        if (!preparedRound) throw new GameDomainError("INVALID_TRANSITION", "Next round was not prepared")
        if (preparedRound.id === next.currentRound?.id) {
          // The eligibility snapshot left fewer than two survivors; the round
          // is paused in place instead of being replaced.
          await tx.update(gameRounds).set({ status: "paused" }).where(eq(gameRounds.id, input.roundId))
        } else {
          await insertNextRound(tx, locked, preparedRound, activeIds)
        }
         await syncSessionFromState(tx, prepared, { version: next.version, updatedAt: now })
      }
    } else {
      await tx.update(gameSessions).set({ version: next.version, updatedAt: now }).where(eq(gameSessions.id, gameId))
    }
      const response = { id: gameId, version: next.version }
      await recordGameMutation(tx, { gameId, identity, action: "response_result", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: next.version, response, status: next.status === "complete" ? "complete" : locked.status })
      return response
   }))
}

function buildStageLedger(
  rounds: (typeof gameRounds.$inferSelect)[],
  attempts: (typeof gameAttempts.$inferSelect)[],
  scoreEvents: (typeof riderScoreEvents.$inferSelect)[],
  players: (typeof gamePlayers.$inferSelect)[],
): GameStage[] {
  const attemptsByRound = new Map<string, Array<{ playerId: string; result: "landed" | "failed" }>>()
  for (const attempt of attempts) {
    const roundAttempts = attemptsByRound.get(attempt.roundId) ?? []
    roundAttempts.push({ playerId: attempt.playerId, result: attempt.result as "landed" | "failed" })
    attemptsByRound.set(attempt.roundId, roundAttempts)
  }

  const playerIdByUserId = new Map(
    players.flatMap((player) => player.userId ? [[player.userId, player.id] as const] : []),
  )
  const scoresByRound = new Map<string, Map<string, { points: number; eventTypes: ScoreEventType[] }>>()
  for (const event of scoreEvents) {
    if (!event.roundId || event.eventType === "winner_bonus") continue
    const playerId = playerIdByUserId.get(event.userId)
    if (!playerId) continue
    const roundScores = scoresByRound.get(event.roundId) ?? new Map()
    const score = roundScores.get(playerId) ?? { points: 0, eventTypes: [] }
    score.points += event.points
    const eventType = event.eventType as ScoreEventType
    if (!score.eventTypes.includes(eventType)) score.eventTypes.push(eventType)
    roundScores.set(playerId, score)
    scoresByRound.set(event.roundId, roundScores)
  }

  return rounds.map((round) => ({
    id: round.id,
    sequence: round.sequence,
    status: round.status as GameStage["status"],
    challengerPlayerId: round.challengerPlayerId,
    spotType: round.spotType,
    trickId: round.trickSourceId ?? round.trickId ?? null,
    trickName: round.trickNameSnapshot,
    trickLevel: round.trickLevel as GameStage["trickLevel"],
    challengerResult: round.challengerResult as GameStage["challengerResult"],
    challengeOutcome: round.challengeOutcome as GameStage["challengeOutcome"],
    leadRetained: round.leadRetained,
    attempts: attemptsByRound.get(round.id) ?? [],
    scores: [...(scoresByRound.get(round.id) ?? new Map())].map(([playerId, score]) => ({
      playerId,
      points: score.points,
      eventTypes: score.eventTypes,
    })),
  }))
}

export function projectGameAttempt(
  attempt: typeof gameAttempts.$inferSelect,
): { playerId: string; result: "landed" | "failed"; submittedAt: string } {
  return {
    playerId: attempt.playerId,
    result: attempt.result as "landed" | "failed",
    submittedAt: attempt.submittedAt.toISOString(),
  }
}

export function assertAuthorizedGameAccess(
  game: {
    mode: string
    status: string
    shareCode: string
    createdBy: string | null
  },
  identity: Identity,
  hasMembership: boolean,
  shareCode?: string,
): void {
  assertGuestAllowedOnTraining(game.mode as GameMode, isGuest(identity))
  const shareAuthorized = Boolean(shareCode) && shareCode === game.shareCode && (
    game.mode === "training" ||
    (game.mode === "challenge" && game.status === "lobby" && identity.userId !== null)
  )
  const ownerMatch = identity.userId ? game.createdBy === identity.userId : false
  if (!ownerMatch && !hasMembership && !shareAuthorized) {
    throw new GameDomainError("NOT_AUTHORIZED", "You do not have access to this game")
  }
}

async function checkGameVersionUnchanged(
  database: Db,
  identity: Identity,
  gameId: string,
  shareCode: string | undefined,
  knownVersion: number,
): Promise<boolean> {
  const [row] = await database
    .select({
      version: gameSessions.version,
      mode: gameSessions.mode,
      status: gameSessions.status,
      shareCode: gameSessions.shareCode,
      createdBy: gameSessions.createdBy,
      isMember: sql<boolean>`exists(select 1 from ${gamePlayers} where ${and(eq(gamePlayers.gameId, gameSessions.id), identityWhereClause(identity))})`,
    })
    .from(gameSessions)
    .where(eq(gameSessions.id, gameId))
  if (!row) throw new GameDomainError("INVALID_INPUT", "Game not found")
  assertAuthorizedGameAccess(row, identity, Boolean(row.isMember), shareCode)
  return row.version === knownVersion
}

async function loadAuthorizedGame(
  tx: Tx,
  identity: Identity,
  gameId: string,
  shareCode?: string,
) {
  const [game] = await tx.select().from(gameSessions).where(eq(gameSessions.id, gameId))
  if (!game) throw new GameDomainError("INVALID_INPUT", "Game not found")
  assertGuestAllowedOnTraining(game.mode, isGuest(identity))
  const [membership] = await tx
    .select({ id: gamePlayers.id })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, gameId), identityWhereClause(identity)))
  assertAuthorizedGameAccess(game, identity, Boolean(membership), shareCode)
  return game
}

export async function proposeGameCategories(identity: Identity, gameId: string, input: MutationInput & { categories: readonly string[] }) {
  const { db } = getDbClient()
  return withDbWrite("games.propose_categories", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, expectedVersion: input.expectedVersion, categories: [...input.categories].sort() })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "propose_categories", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    if (!["lobby", "active"].includes(locked.status)) throw new GameDomainError("INVALID_TRANSITION", "Categories can only be changed in a lobby or active game")
    if (locked.challengeRule !== "flexible") throw new GameDomainError("INVALID_TRANSITION", "Categories can only be changed in flexible mode")
    const aggregate = await loadGameState(tx, gameId)
    if (aggregate.state.version !== input.expectedVersion) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
    const used = await usedTrickIdsForGame(tx, gameId)
    const { proposeCategories: proposeEngine } = await import("@/lib/games/engine")
    const next = proposeEngine(aggregate.state, identity, [...input.categories], catalog, used)
    // Solo immediate must persist round even if trickId unchanged to clear blockedReason (no reload)
    if (next.currentRound) {
      const shouldPersist = next.currentRound.status !== aggregate.state.currentRound?.status || next.currentRound.trick?.sourceId !== aggregate.state.currentRound?.trick?.sourceId || next.currentRound.blockedReason !== aggregate.state.currentRound?.blockedReason || next.selectedCategories !== aggregate.state.selectedCategories
      if (shouldPersist) {
        const catalogTrickId = next.currentRound.trick ? await catalogTrickIdForSource(tx, locked.catalogId, next.currentRound.trick.sourceId) : null
        await persistRoundSetup(tx, next.currentRound, null, catalogTrickId)
      }
    }
    await syncSessionFromState(tx, next, { updatedAt: new Date() })
    const response = { id: gameId, version: next.version }
    await recordGameMutation(tx, { gameId, identity, action: "propose_categories", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: next.version, response, status: next.status })
    return response
  }))
}

export async function voteGameCategoryProposal(identity: Identity, gameId: string, input: MutationInput & { accept: boolean }) {
  const { db } = getDbClient()
  return withDbWrite("games.vote_categories", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, expectedVersion: input.expectedVersion, accept: input.accept })
    const locked = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, { identity, action: "vote_categories", idempotencyKey: input.idempotencyKey, fingerprint, gameId })
    if (replay) return replay
    assertGuestAllowedOnTraining(locked.mode, isGuest(identity))
    if (!["lobby", "active"].includes(locked.status)) throw new GameDomainError("INVALID_TRANSITION", "Categories can only be voted in a lobby or active game")
    if (locked.challengeRule !== "flexible") throw new GameDomainError("INVALID_TRANSITION", "Categories can only be changed in flexible mode")
    const aggregate = await loadGameState(tx, gameId)
    if (aggregate.state.version !== input.expectedVersion) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    const catalog = await loadPersistedCatalog(tx, locked.catalogId, aggregate.state.disciplineSlug)
    const used = await usedTrickIdsForGame(tx, gameId)
    const { voteCategoryProposal: voteEngine } = await import("@/lib/games/engine")
    const next = voteEngine(aggregate.state, identity, input.accept, catalog, used)
    if (next.currentRound) {
      const shouldPersist = next.currentRound.status !== aggregate.state.currentRound?.status || next.currentRound.trick?.sourceId !== aggregate.state.currentRound?.trick?.sourceId || next.currentRound.blockedReason !== aggregate.state.currentRound?.blockedReason
      if (shouldPersist) {
        const catalogTrickId = next.currentRound.trick ? await catalogTrickIdForSource(tx, locked.catalogId, next.currentRound.trick.sourceId) : null
        await persistRoundSetup(tx, next.currentRound, null, catalogTrickId)
      }
    }
    await syncSessionFromState(tx, next, { updatedAt: new Date() })
    const response = { id: gameId, version: next.version }
    await recordGameMutation(tx, { gameId, identity, action: "vote_categories", idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint, resultingVersion: next.version, response, status: next.status })
    return response
  }))
}

export async function getGameState(identity: Identity, gameId: string, shareCode?: string, knownVersion?: number): Promise<GameStateProjection | null> {
  return withDbRead("games.state", async () => {
  const { db: database } = getDbClient()
  if (knownVersion !== undefined) {
    const unchanged = await checkGameVersionUnchanged(
      database,
      identity,
      gameId,
      shareCode,
      knownVersion,
    )
    if (unchanged) return null
  }
  return database.transaction(async (tx) => {
  const db = tx
  const game = await loadAuthorizedGame(db, identity, gameId, shareCode)
  if (knownVersion !== undefined && game.version === knownVersion) return null

  const [players, recentRoundRows, raceLapRows] = await Promise.all([
    db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)),
    db.select().from(gameRounds).where(eq(gameRounds.gameId, gameId)).orderBy(desc(gameRounds.sequence)).limit(DEFAULT_GAME_HISTORY_LIMIT),
    db.select().from(gameRaceLaps).where(eq(gameRaceLaps.gameId, gameId)).orderBy(asc(gameRaceLaps.lapNumber), asc(gameRaceLaps.submittedAt)).limit(RACE_LAP_STATE_LIMIT),
  ])
  let roundRows = recentRoundRows
  if (game.currentRoundId && !roundRows.some((round) => round.id === game.currentRoundId)) {
    const [current] = await db.select().from(gameRounds).where(eq(gameRounds.id, game.currentRoundId))
    if (current) roundRows = [...roundRows.slice(0, DEFAULT_GAME_HISTORY_LIMIT - 1), current]
  }
  roundRows = [...roundRows].sort((left, right) => left.sequence - right.sequence)
  const currentRound = roundRows.find((round) => round.id === game.currentRoundId) ?? null
  const viewerPlayer = identity.userId
    ? players.find((player) => player.userId === identity.userId)
    : identity.guestToken
      ? players.find((player) => player.guestToken === identity.guestToken)
      : undefined
  const roundIds = roundRows.map((round) => round.id)
  const [attemptRows, scoreRows] = await Promise.all([
    roundIds.length > 0
      ? db.select().from(gameAttempts).where(inArray(gameAttempts.roundId, roundIds))
      : Promise.resolve([] as (typeof gameAttempts.$inferSelect)[]),
    game.mode === "challenge" && roundIds.length > 0
      ? db.select().from(riderScoreEvents).where(and(eq(riderScoreEvents.gameId, gameId), or(inArray(riderScoreEvents.roundId, roundIds), isNull(riderScoreEvents.roundId))))
      : Promise.resolve([] as (typeof riderScoreEvents.$inferSelect)[]),
  ])
  const verifications = currentRound
    ? await db.select({ playerId: gameLocationVerifications.playerId, status: gameLocationVerifications.status, distanceMeters: gameLocationVerifications.distanceMeters, accuracyMeters: gameLocationVerifications.accuracyMeters, verifiedAt: gameLocationVerifications.verifiedAt, expiresAt: gameLocationVerifications.expiresAt }).from(gameLocationVerifications).where(eq(gameLocationVerifications.roundId, currentRound.id))
    : []
  const attempts = currentRound
    ? attemptRows.filter((attempt) => attempt.roundId === currentRound.id)
    : []
  const stageLedger = buildStageLedger(roundRows, attemptRows, scoreRows, players)
  const playerIdByUserId = new Map(
    players.flatMap((player) => player.userId ? [[player.userId, player.id] as const] : []),
  )
  const winnerBonusEvent = scoreRows.find((event) => event.eventType === "winner_bonus")
  const winnerBonusPlayerId = winnerBonusEvent
    ? playerIdByUserId.get(winnerBonusEvent.userId)
    : undefined
  const winnerBonus = winnerBonusEvent && winnerBonusPlayerId
    ? { playerId: winnerBonusPlayerId, points: winnerBonusEvent.points }
    : null
  const [viewerStats] = identity.userId && game.mode === "challenge"
    ? await db.select({ totalPoints: riderStats.totalPoints }).from(riderStats).where(eq(riderStats.userId, identity.userId))
    : [undefined]
  let availableAlternatives: { spotType: string; level: TrickLevel }[] = []
  if (currentRound?.status === "no_compatible_trick" && game.catalogId) {
    const availableTypes = new Set((game.availableSpotTypes as SpotTypeSnapshot[]).map((type) => type.slug))
    const rows = await db
      .select({ level: challengeCatalogTricks.level, spotType: challengeTrickSpotTypes.spotTypeSlug })
      .from(challengeCatalogTricks)
      .innerJoin(challengeTrickSpotTypes, eq(challengeTrickSpotTypes.trickId, challengeCatalogTricks.id))
      .where(eq(challengeCatalogTricks.catalogId, game.catalogId))
    availableAlternatives = [...new Map(
      rows
        .filter((row) => availableTypes.has(row.spotType))
        .map((row) => [`${row.spotType}:${row.level}`, { spotType: row.spotType, level: row.level as TrickLevel }]),
    ).values()]
  }
  return gameStateSchema.parse({
    id: game.id,
    createdBy: game.createdBy,
    creatorDisplayName: game.creatorDisplayName,
    status: game.status,
    version: game.version,
    shareCode: game.shareCode,
    mode: game.mode,
    ruleMode: game.challengeRule,
    gameFormat: (game as typeof game & RacingSessionFields).gameFormat,
    trainingVariant: game.trainingVariant,
    lapCount: (game as typeof game & RacingSessionFields).lapCount,
    ghostMode: (game as typeof game & RacingSessionFields).ghostMode === "global_best",
     lapTimes: raceLapRows.map((lap) => ({
       playerId: lap.playerId,
       lap: lap.lapNumber,
       milliseconds: lap.milliseconds,
     })),
     disciplineSlug: game.disciplineSlug,
    challengeKey: game.challengeKey,
    gameName: game.gameName,
    eliminationWord: game.eliminationWord,
    wordLength: game.wordLength,
    catalogId: game.catalogId,
    spotId: game.spotId,
    scheduledStartAt: game.scheduledStartAt?.toISOString() ?? null,
    timezone: game.timezone,
    locationRadiusMeters: game.locationRadiusMeters,
     nextSpotType: game.nextSpotType,
     nextLevel: game.nextLevel,
     selectedCategories: (game.selectedCategories as readonly string[] | null) ?? null,
     pendingCategoryProposal: (() => {
       const cats = (game as {  pendingCategories: readonly string[] | null }).pendingCategories ?? null
       const proposer = (game as {  pendingProposerPlayerId: string | null }).pendingProposerPlayerId ?? null
       const votes = (game as {  pendingVotes: readonly { playerId: string; vote: "pending" | "accepted" | "rejected" }[] | null }).pendingVotes ?? null
       const created = (game as {  pendingProposalCreatedAt: Date | null }).pendingProposalCreatedAt ?? null
       if (!cats || !proposer || !votes || !created) return null
       return { categories: cats, proposerPlayerId: proposer, votes, createdAt: created.toISOString() }
     })(),
     availableSpotTypes: game.availableSpotTypes,
    currentChallengerPlayerId: game.currentChallengerPlayerId,
    winnerPlayerId: game.winnerPlayerId,
    rotationIndex: game.rotationIndex,
    viewerPlayerId: viewerPlayer?.id ?? null,
    viewerPoints: viewerStats?.totalPoints ?? null,
    winnerBonus,
    viewerIsHost: identity.userId !== null && game.createdBy === identity.userId
      ? true
      : viewerPlayer?.seatOrder === 0,
    weatherForecastIcon: (game as {  weatherForecastIcon: string | null }).weatherForecastIcon ?? null,
    weatherObservedIcon: (game as {  weatherObservedIcon: string | null }).weatherObservedIcon ?? null,
    weatherConfirmed: (game as {  weatherConfirmed: boolean | null }).weatherConfirmed ?? null,
    weatherForecastDescription: (game as {  weatherForecastDescription: string | null }).weatherForecastDescription ?? null,
    weatherForecastTemp: (game as {  weatherForecastTemp: number | null }).weatherForecastTemp ?? null,
    weatherReportedAt: (game as {  weatherReportedAt: Date | null }).weatherReportedAt?.toISOString() ?? null,
    players: players.map((player) => ({ id: player.id, userId: player.userId, displayName: player.displayName, seatOrder: player.seatOrder, letters: player.letters, failedAttempts: player.failedAttempts, status: player.status })),
    currentRound: currentRound ? {
      id: currentRound.id,
      sequence: currentRound.sequence,
      status: currentRound.status,
      challengerPlayerId: currentRound.challengerPlayerId,
      eligiblePlayerIds: currentRound.eligiblePlayerIds,
      spotType: currentRound.spotType,
      spotTypeSnapshot: currentRound.spotTypeSnapshot,
      spotTypeChanged: currentRound.spotTypeChanged,
      spotTypeChangedByPlayerId: currentRound.spotTypeChangedByPlayerId,
      trickId: currentRound.trickId,
      trickName: currentRound.trickNameSnapshot,
      trickDescription: currentRound.trickDescriptionSnapshot,
      trickLevel: currentRound.trickLevel,
      trickDisciplineSnapshot: currentRound.trickDisciplineSnapshot,
      blockedReason: currentRound.blockedReason,
      availableAlternatives,
      challengerResult: currentRound.challengerResult,
      challengeOutcome: currentRound.challengeOutcome,
      requiredResponsePlayerIds: currentRound.requiredResponsePlayerIds,
       attempts: attempts.map(projectGameAttempt),
      verifications: verifications.map((verification) => ({
        ...verification,
        status:
          verification.status === "verified" &&
          verification.expiresAt !== null &&
          verification.expiresAt <= new Date()
            ? "expired"
            : verification.status,
        verifiedAt: verification.verifiedAt?.toISOString() ?? null,
        expiresAt: verification.expiresAt?.toISOString() ?? null,
      })),
    } : null,
    stageLedger,
  })
  }, { isolationLevel: "repeatable read", accessMode: "read only" })
  })
}

const roundHistoryCursorSchema = z.object({ sequence: z.number().int().positive() }).strict()
const lapHistoryCursorSchema = z.object({ id: z.string().min(1) }).strict()

function encodeHistoryCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function decodeHistoryCursor<T>(value: string | undefined, schema: z.ZodType<T>, label: string): T | null {
  if (!value) return null
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
    if (parsed.success) return parsed.data
  } catch {
    // Fall through to the domain error below.
  }
  throw new GameDomainError("INVALID_INPUT", `Invalid ${label} cursor`)
}

export async function getGameHistory(
  identity: Identity,
  gameId: string,
  options: {
    shareCode?: string
    limit?: number
    roundCursor?: string
    lapCursor?: string
  } = {},
): Promise<GameHistoryResponse> {
  const limit = Math.min(MAX_GAME_HISTORY_LIMIT, Math.max(1, options.limit ?? DEFAULT_GAME_HISTORY_LIMIT))
  const roundCursor = decodeHistoryCursor(options.roundCursor, roundHistoryCursorSchema, "round history")
  const lapCursor = decodeHistoryCursor(options.lapCursor, lapHistoryCursorSchema, "lap history")
  const { db } = getDbClient()
  return withDbRead("games.history", () => db.transaction(async (tx) => {
    await loadAuthorizedGame(tx, identity, gameId, options.shareCode)
    const roundRows = await tx
      .select()
      .from(gameRounds)
      .where(and(
        eq(gameRounds.gameId, gameId),
        roundCursor ? lt(gameRounds.sequence, roundCursor.sequence) : undefined,
      ))
      .orderBy(desc(gameRounds.sequence))
      .limit(limit + 1)
    const hasMoreRounds = roundRows.length > limit
    const pageRounds = roundRows.slice(0, limit)
    const roundIds = pageRounds.map((round) => round.id)
    const [players, attempts, scores] = await Promise.all([
      tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)),
      roundIds.length > 0
        ? tx.select().from(gameAttempts).where(inArray(gameAttempts.roundId, roundIds)).orderBy(asc(gameAttempts.submittedAt))
        : Promise.resolve([] as (typeof gameAttempts.$inferSelect)[]),
      roundIds.length > 0
        ? tx.select().from(riderScoreEvents).where(and(
            eq(riderScoreEvents.gameId, gameId),
            or(inArray(riderScoreEvents.roundId, roundIds), isNull(riderScoreEvents.roundId)),
          )).orderBy(asc(riderScoreEvents.createdAt))
        : Promise.resolve([] as (typeof riderScoreEvents.$inferSelect)[]),
    ])
    const lapRows = await tx
      .select()
      .from(gameRaceLaps)
      .where(and(
        eq(gameRaceLaps.gameId, gameId),
        lapCursor
          ? gt(gameRaceLaps.id, lapCursor.id)
          : undefined,
      ))
      .orderBy(asc(gameRaceLaps.id))
      .limit(limit + 1)
    const hasMoreLaps = lapRows.length > limit
    const pageLaps = lapRows.slice(0, limit)
    const stages = buildStageLedger([...pageRounds].sort((left, right) => left.sequence - right.sequence), attempts, scores, players)
    const playerIdByUserId = new Map(
      players.flatMap((player) => player.userId ? [[player.userId, player.id] as const] : []),
    )
    const lastRound = pageRounds.at(-1)
    const lastLap = pageLaps.at(-1)
    const response = {
      rounds: stages,
      attempts: attempts.map((attempt) => ({
        roundId: attempt.roundId,
        playerId: attempt.playerId,
        result: attempt.result as "landed" | "failed",
        submittedAt: attempt.submittedAt.toISOString(),
      })),
      scoreEvents: scores.flatMap((event) => {
        const playerId = playerIdByUserId.get(event.userId)
        if (!playerId) return []
        return [{
          roundId: event.roundId,
          playerId,
          eventType: event.eventType as "challenger_landed" | "response_landed" | "winner_bonus",
          points: event.points,
          trickLevel: event.trickLevel as TrickLevel | null,
          createdAt: event.createdAt.toISOString(),
        }]
      }),
      raceLaps: pageLaps.map((lap) => ({
        playerId: lap.playerId,
        lap: lap.lapNumber,
        milliseconds: lap.milliseconds,
        submittedAt: lap.submittedAt.toISOString(),
      })),
      nextRoundCursor: hasMoreRounds && lastRound
        ? encodeHistoryCursor({ sequence: lastRound.sequence })
        : null,
      nextLapCursor: hasMoreLaps && lastLap
        ? encodeHistoryCursor({ id: lastLap.id })
        : null,
    }
    return gameHistoryResponseSchema.parse(response)
  }, { isolationLevel: "repeatable read", accessMode: "read only" }))
}

export async function submitRacingLap(identity: Identity, gameId: string, input: MutationInput & { milliseconds: number }) {
  if (!Number.isInteger(input.milliseconds) || input.milliseconds <= 0 || input.milliseconds > 60 * 60 * 1000) {
    throw new GameDomainError("INVALID_INPUT", "Lap time must be between 1ms and 60 minutes")
  }
  const { db } = getDbClient()
  return withDbWrite("games.submit_lap", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, expectedVersion: input.expectedVersion, milliseconds: input.milliseconds })
    const game = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "submit_lap",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      gameId,
    })
    if (replay) return replay
    if (game.gameFormat !== "bmx_track_racing") throw new GameDomainError("INVALID_INPUT", "This is not a BMX racing game")
    assertActiveGame(game)
    const [player] = await tx.select().from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), identityWhereClause(identity)))
    if (!player || player.status !== "active") throw new GameDomainError("NOT_AUTHORIZED", "You are not an active rider")
    if (game.version !== input.expectedVersion) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    const lapRows = await tx
      .select()
      .from(gameRaceLaps)
      .where(eq(gameRaceLaps.gameId, gameId))
    const lapCount = game.lapCount ?? 1
    const nextLap = lapRows.filter((lap) => lap.playerId === player.id).length + 1
    if (nextLap > lapCount) throw new GameDomainError("INVALID_TRANSITION", "All laps are already recorded")
    if (lapRows.some((lap) => lap.playerId === player.id && lap.lapNumber === nextLap)) {
      throw new GameDomainError("DUPLICATE_ATTEMPT", "This lap has already been recorded")
    }
    await tx.insert(gameRaceLaps).values({
      gameId,
      playerId: player.id,
      lapNumber: nextLap,
      milliseconds: input.milliseconds,
    })
    const nextTimes = [
      ...lapRows.map((lap) => ({ playerId: lap.playerId, lap: lap.lapNumber, milliseconds: lap.milliseconds })),
      { playerId: player.id, lap: nextLap, milliseconds: input.milliseconds },
    ]
    const nextVersion = game.version + 1
    const activePlayers = await tx.select({ id: gamePlayers.id }).from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.status, "active")))
    const finished = activePlayers.every(({ id }) => nextTimes.filter((lap) => lap.playerId === id).length >= lapCount)
    const totals = activePlayers.map(({ id }) => ({ id, total: nextTimes.filter((lap) => lap.playerId === id).reduce((sum, lap) => sum + lap.milliseconds, 0) })).sort((left, right) => left.total - right.total)
    const now = new Date()
    const status = finished && totals[0] ? "complete" : game.status
    await tx.update(gameSessions).set({ version: nextVersion, updatedAt: now, ...(status === "complete" && totals[0] ? { status, winnerPlayerId: totals[0].id, completedAt: now } : {}) }).where(eq(gameSessions.id, gameId))
    const response = { id: gameId, version: nextVersion }
    await recordGameMutation(tx, {
      gameId,
      identity,
      action: "submit_lap",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: nextVersion,
      response,
      status,
    })
    return response
  }))
}

export async function getGlobalBestRacingTime(lapCount: number): Promise<number | null> {
  const { db } = getDbClient()
  const [result] = await withDbRead("games.global_best_racing_time", () =>
    db.execute<{ milliseconds: number | null }>(sql`
      select min(total_time)::int as milliseconds
        from (
          select laps.game_id, laps.player_id, sum(laps.milliseconds)::int as total_time
            from game_race_laps laps
            join game_sessions games on games.id = laps.game_id
           where games.game_format = 'bmx_track_racing'
             and games.status = 'complete'
             and games.lap_count = ${lapCount}
           group by laps.game_id, laps.player_id
          having count(*) = ${lapCount}
        ) completed_races
    `),
  )
  return result?.milliseconds ?? null
}

export async function resolveGameIdByShareCode(shareCode: string) {
  const { db } = getDbClient()
  const [game] = await withDbRead(
    "games.resolve_share_code",
    () => db.select({ id: gameSessions.id, mode: gameSessions.mode }).from(gameSessions).where(eq(gameSessions.shareCode, shareCode)),
  )
  if (!game) throw new GameDomainError("INVALID_INPUT", "Game not found")
  return game
}

export interface GameOgPreview {
  id: string
  shareCode: string
  mode: "challenge" | "training"
  gameName: string
  creatorDisplayName: string
  disciplineSlug: string
  status: string
  spot: { id: string; name: string; city: string; imageUrl: string | null } | null
  // Set when the spot was hard-deleted for moderation: the game survives
  // detached, and these snapshots keep history/previews readable.
  removedSpot: { name: string; city: string } | null
  weather: {
    forecastIcon: string | null
    forecastDescription: string | null
    forecastTemp: number | null
    observedIcon: string | null
    confirmed: boolean | null
  } | null
  scheduledStartAt: string | null
  createdAt: string
  timezone: string | null
}

async function fetchGameOgPreview(where: { id?: string; shareCode?: string }): Promise<GameOgPreview | null> {
  const { db } = getDbClient()
  return withDbRead("games.og_preview", async () => {
    const [game] = await db
      .select({
        id: gameSessions.id,
        shareCode: gameSessions.shareCode,
        mode: gameSessions.mode,
        gameName: gameSessions.gameName,
        creatorDisplayName: gameSessions.creatorDisplayName,
        disciplineSlug: gameSessions.disciplineSlug,
        status: gameSessions.status,
        spotId: gameSessions.spotId,
        spotRemoved: gameSessions.spotRemoved,
        spotNameSnapshot: gameSessions.spotNameSnapshot,
        spotCitySnapshot: gameSessions.spotCitySnapshot,
        weatherForecastIcon: gameSessions.weatherForecastIcon,
        weatherForecastDescription: gameSessions.weatherForecastDescription,
        weatherForecastTemp: gameSessions.weatherForecastTemp,
        weatherObservedIcon: gameSessions.weatherObservedIcon,
        weatherConfirmed: gameSessions.weatherConfirmed,
        scheduledStartAt: gameSessions.scheduledStartAt,
        createdAt: gameSessions.createdAt,
        timezone: gameSessions.timezone,
      })
      .from(gameSessions)
      .where(where.id ? eq(gameSessions.id, where.id) : eq(gameSessions.shareCode, where.shareCode as string))
      .limit(1)

    if (!game) return null

    let spot: GameOgPreview["spot"] = null
    if (game.spotId) {
      const [spotRow] = await db
        .select({ id: spots.id, name: spots.name, city: spots.city, imageUrl: spots.imageUrl })
        .from(spots)
        .where(eq(spots.id, game.spotId))
        .limit(1)
      if (spotRow) spot = spotRow
    }
    const removedSpot =
      !spot && game.spotRemoved && game.spotNameSnapshot
        ? { name: game.spotNameSnapshot, city: game.spotCitySnapshot ?? "" }
        : null

    return {
      id: game.id,
      shareCode: game.shareCode,
      mode: game.mode as "challenge" | "training",
      gameName: game.gameName,
      creatorDisplayName: game.creatorDisplayName,
      disciplineSlug: game.disciplineSlug,
      status: game.status,
      spot,
      removedSpot,
      weather:
        game.weatherForecastIcon || game.weatherObservedIcon
          ? {
              forecastIcon: game.weatherForecastIcon,
              forecastDescription: game.weatherForecastDescription,
              forecastTemp: game.weatherForecastTemp,
              observedIcon: game.weatherObservedIcon,
              confirmed: game.weatherConfirmed,
            }
          : null,
      scheduledStartAt: game.scheduledStartAt ? game.scheduledStartAt.toISOString() : null,
      createdAt: game.createdAt.toISOString(),
      timezone: game.timezone,
    }
  })
}

export async function getGameOgPreviewById(gameId: string): Promise<GameOgPreview | null> {
  return fetchGameOgPreview({ id: gameId })
}

export async function getGameOgPreviewByShareCode(shareCode: string): Promise<GameOgPreview | null> {
  return fetchGameOgPreview({ shareCode })
}

export async function listGamesForUser(userId: string, limit = 20): Promise<GameListResponse> {
  const { db } = getDbClient()
  const [created, joined] = await withDbRead(
    "games.list_for_user_membership",
    () => Promise.all([
      db.select({ id: gameSessions.id }).from(gameSessions).where(eq(gameSessions.createdBy, userId)),
      db.select({ id: gamePlayers.gameId }).from(gamePlayers).where(eq(gamePlayers.userId, userId)),
    ]),
  )
  const ids = [...new Set([...created.map((row) => row.id), ...joined.map((row) => row.id)])]
  if (ids.length === 0) return []
  const games = await withDbRead("games.list_for_user", () =>
    db.select({
      id: gameSessions.id,
      status: gameSessions.status,
      shareCode: gameSessions.shareCode,
      mode: gameSessions.mode,
      disciplineSlug: gameSessions.disciplineSlug,
      gameName: gameSessions.gameName,
      spotId: gameSessions.spotId,
      scheduledStartAt: gameSessions.scheduledStartAt,
      nextSpotType: gameSessions.nextSpotType,
      version: gameSessions.version,
      updatedAt: gameSessions.updatedAt,
    }).from(gameSessions).where(inArray(gameSessions.id, ids)).orderBy(desc(gameSessions.updatedAt)).limit(limit),
  )
  return gameListResponseSchema.parse(games.map((game) => ({
    ...game,
    scheduledStartAt: game.scheduledStartAt?.toISOString() ?? null,
    updatedAt: game.updatedAt.toISOString(),
  })))
}

export async function listOpenTrainingGames(identity: Identity): Promise<OpenTrainingGamesResponse> {
  const { db } = getDbClient()
  const [rows] = await withDbRead("games.list_open_training", () => Promise.all([
    db
      .select({
        id: gameSessions.id,
        version: gameSessions.version,
        status: gameSessions.status,
        mode: gameSessions.mode,
        disciplineSlug: gameSessions.disciplineSlug,
        gameName: gameSessions.gameName,
        nextSpotType: gameSessions.nextSpotType,
        updatedAt: gameSessions.updatedAt,
      })
      .from(gameSessions)
      .leftJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
      .where(and(
        eq(gameSessions.mode, "training"),
        inArray(gameSessions.status, ["lobby", "active"]),
        identity.userId
          ? eq(gameSessions.createdBy, identity.userId)
          : and(eq(gamePlayers.guestToken, identity.guestToken as string), eq(gamePlayers.seatOrder, 0)),
      ))
      .orderBy(desc(gameSessions.updatedAt))
      .limit(3),
  ]))
  return openTrainingGamesResponseSchema.parse(
    rows.map((game) => ({ ...game, updatedAt: game.updatedAt.toISOString() })),
  )
}

export async function getOpenGameForUser(userId: string) {
  const { db } = getDbClient()
  const [game] = await withDbRead("games.open_for_user", () =>
    db
      .select({ id: gameSessions.id, status: gameSessions.status })
      .from(gameSessions)
      .leftJoin(gamePlayers, eq(gamePlayers.gameId, gameSessions.id))
      .where(and(
          eq(gameSessions.mode, "challenge"),
        inArray(gameSessions.status, ["lobby", "active"]),
        or(eq(gameSessions.createdBy, userId), eq(gamePlayers.userId, userId)),
      ))
      .limit(1),
  )
  return game ?? null
}

export async function leaveGame(identity: Identity, gameId: string, input: MutationInput) {
  const { db } = getDbClient()
  return withDbWrite("games.leave", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, expectedVersion: input.expectedVersion })
    const game = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "leave_game",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      gameId,
    })
    if (replay) return replay
    assertGuestAllowedOnTraining(game.mode, isGuest(identity))
    if (input.expectedVersion !== game.version) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    if (game.status !== "lobby") throw new GameDomainError("INVALID_TRANSITION", "Players can only leave a lobby")

    const [player] = await tx.select().from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), identityWhereClause(identity)))
    if (!player) throw new GameDomainError("NOT_AUTHORIZED", "You are not a participant in this game")
    if (player.status === "left") throw new GameDomainError("INVALID_TRANSITION", "You already left this game")
    if (identity.userId ? game.createdBy === identity.userId : player.seatOrder === 0) {
      throw new GameDomainError("INVALID_TRANSITION", "The creator must cancel the game instead of leaving")
    }

    await tx.update(gamePlayers).set({ status: "left" }).where(eq(gamePlayers.id, player.id))
    const version = game.version + 1
    await tx.update(gameSessions).set({ version, updatedAt: new Date() }).where(eq(gameSessions.id, gameId))
    const response = { id: gameId, version }
    await recordGameMutation(tx, {
      gameId,
      identity,
      action: "leave_game",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: version,
      response,
      status: game.status,
    })
    return response
  }))
}

export async function cancelGame(identity: Identity, gameId: string, input: MutationInput) {
  const { db } = getDbClient()
  return withDbWrite("games.cancel", () => db.transaction(async (tx) => {
    const fingerprint = requestFingerprint({ gameId, expectedVersion: input.expectedVersion })
    const game = await lockGameSession(tx, gameId)
    const replay = await findIdempotentResult(tx, {
      identity,
      action: "cancel_game",
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      gameId,
    })
    if (replay) return replay
    assertGuestAllowedOnTraining(game.mode, isGuest(identity))
    if (input.expectedVersion !== game.version) throw new GameDomainError("STALE_VERSION", "The game state is stale")
    const [actorPlayer] = identity.userId
      ? await tx.select({ status: gamePlayers.status }).from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, identity.userId))).limit(1)
      : await tx.select({ status: gamePlayers.status }).from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.guestToken, identity.guestToken as string))).limit(1)
    if (!actorPlayer || actorPlayer.status === "left") {
      throw new GameDomainError("NOT_AUTHORIZED", "You are not a participant in this game")
    }
    if (game.status === "complete" || game.status === "cancelled") throw new GameDomainError("INVALID_TRANSITION", "This game is already closed")

    if (game.status === "active" && game.currentRoundId) {
      const [round] = await tx.select({ status: gameRounds.status }).from(gameRounds).where(eq(gameRounds.id, game.currentRoundId))
      if (round && !["resolved", "cancelled"].includes(round.status)) {
        await tx.update(gameRounds).set({ status: "cancelled" }).where(eq(gameRounds.id, game.currentRoundId))
      }
    }

    const version = game.version + 1
    await tx.update(gameSessions).set({ status: "cancelled", version, cancelledAt: new Date(), updatedAt: new Date() }).where(eq(gameSessions.id, gameId))
    const response = { id: gameId, version }
    await recordGameMutation(tx, {
      gameId,
      identity,
      action: "cancel_game",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resultingVersion: version,
      response,
      status: "cancelled",
    })
    return response
  }))
}
