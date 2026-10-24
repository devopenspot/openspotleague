import type {
  AttemptResult,
  ChallengeKey,
  DisciplineSlug,
  GameMode,
  GameFormat,
  RuleMode,
  GameStatus,
  TrainingVariant,
  PlayerStatus,
  RoundStatus,
  SpotTypeSnapshot,
  TrickDefinition,
  TrickLevel,
  VerificationStatus,
} from "@/lib/schemas/game"
import { gameDefinitionSchema } from "@/lib/schemas/game"
import gameDefinitionsRaw from "@/data/game_definitions.json"

export const PLAYER_LIMITS = gameDefinitionsRaw.player_limits as { readonly min: 2; readonly max: 2 }
export const START_GRACE_MINUTES = gameDefinitionsRaw.start_grace_minutes
export const DEFAULT_LOCATION_RADIUS_METERS = gameDefinitionsRaw.location_defaults.radius_meters
export const DEFAULT_LOCATION_MAX_ACCURACY_METERS = gameDefinitionsRaw.location_defaults.max_accuracy_meters
export const DEFAULT_LOCATION_VERIFICATION_TTL_SECONDS = gameDefinitionsRaw.location_defaults.verification_ttl_seconds
export const LEVEL_POINTS = gameDefinitionsRaw.level_points as unknown as Record<TrickLevel, number>
export const WINNER_BONUS_POINTS = gameDefinitionsRaw.winner_bonus_points

export type GameDefinition = {
  sportPreference: "Roller" | "Skateboard" | "BMX" | "Scooter"
  disciplineSlug: DisciplineSlug
  challengeKey: ChallengeKey
  gameName: string
  eliminationWord: string
  wordLength: 4 | 5
  catalogPath: string
}

const defsMap = {} as Record<DisciplineSlug, GameDefinition>
for (const d of gameDefinitionsRaw.disciplines) {
  defsMap[d.discipline_slug as DisciplineSlug] = {
    sportPreference: d.sport_preference as GameDefinition["sportPreference"],
    disciplineSlug: d.discipline_slug as DisciplineSlug,
    challengeKey: d.challenge_key as ChallengeKey,
    gameName: d.game_name,
    eliminationWord: d.elimination_word,
    wordLength: d.word_length as 4 | 5,
    catalogPath: d.catalog_path,
  }
}

export const GAME_DEFINITIONS: Record<DisciplineSlug, GameDefinition> = defsMap

const CHALLENGE_KEY_FOR_DISCIPLINE: Record<DisciplineSlug, ChallengeKey> = {
  roller: "blade",
  skateboard: "skate",
  bmx: "bike",
  scooter: "scoot",
}

const DISCIPLINE_FOR_CHALLENGE_KEY: Record<ChallengeKey, DisciplineSlug> = {
  blade: "roller",
  skate: "skateboard",
  bike: "bmx",
  scoot: "scooter",
}

for (const [disciplineSlug, definition] of Object.entries(GAME_DEFINITIONS)) {
  const parsed = gameDefinitionSchema.parse(definition)
  if (parsed.disciplineSlug !== disciplineSlug) {
    throw new Error(`Definition key ${disciplineSlug} does not match its discipline slug`)
  }
  if (parsed.challengeKey !== CHALLENGE_KEY_FOR_DISCIPLINE[parsed.disciplineSlug]) {
    throw new Error(`Definition ${disciplineSlug} has an invalid challenge key`)
  }
  if (parsed.eliminationWord !== parsed.challengeKey.toUpperCase()) {
    throw new Error(`Definition ${disciplineSlug} has an invalid elimination word`)
  }
}

export function normalizeChallengeKey(input: string): ChallengeKey | null {
  const normalized = input.trim().normalize("NFC").toLocaleLowerCase("en")
  return (Object.keys(DISCIPLINE_FOR_CHALLENGE_KEY) as ChallengeKey[]).find(
    (key) => key === normalized,
  ) ?? null
}

export function disciplineForChallengeKey(key: string): DisciplineSlug | null {
  const challengeKey = normalizeChallengeKey(key)
  if (!challengeKey) return null
  return DISCIPLINE_FOR_CHALLENGE_KEY[challengeKey]
}

export function challengeKeyForDiscipline(discipline: DisciplineSlug): ChallengeKey {
  return CHALLENGE_KEY_FOR_DISCIPLINE[discipline]
}

export type Player = {
  id: string
  userId: string | null
  guestToken: string | null
  displayName: string
  letters: string
  failedAttempts: number
  status: PlayerStatus
}

export type LocationVerification = {
  playerId: string
  status: VerificationStatus
}

export type Attempt = {
  playerId: string
  result: Exclude<AttemptResult, "pending">
}

export type TrickSnapshot = Pick<TrickDefinition, "id" | "name" | "description" | "level"> & {
  catalogTrickId: string | null
  sourceId: string
  discipline: DisciplineSlug
  compatibleSpotTypes: readonly string[]
  categories: readonly string[]
}

export type Round = {
  id: string
  sequence: number
  status: RoundStatus
  challengerPlayerId: string | null
  eligiblePlayerIds: readonly string[]
  spotType: string
  spotTypeSnapshot: readonly SpotTypeSnapshot[]
  spotTypeChanged: boolean
  spotTypeChangedByPlayerId: string | null
  level: TrickLevel | null
  trick: TrickSnapshot | null
  challengerResult: AttemptResult
  requiredResponsePlayerIds: readonly string[]
  attempts: readonly Attempt[]
  failedPlayerIds: readonly string[]
  challengeOutcome: "established" | "failed_to_establish" | "resolved" | null
  leadRetained: boolean
  blockedReason: string | null
}

export type GameState = {
  id: string
  mode: GameMode
  ruleMode?: RuleMode
  gameFormat?: GameFormat
  trainingVariant: TrainingVariant
  lapCount?: number | null
  ghostMode?: boolean
  lapTimes?: readonly { playerId: string; lap: number; milliseconds: number }[]
  disciplineSlug: DisciplineSlug
  challengeKey: ChallengeKey
  gameName: string
  eliminationWord: string
  wordLength: 4 | 5
  catalogId: string | null
  status: GameStatus
  createdBy: string | null
  creatorDisplayName: string
  players: readonly Player[]
  availableSpotTypes: readonly SpotTypeSnapshot[]
  initialSpotType: string
  nextSpotType: string
  nextLevel: TrickLevel | null
  selectedCategories?: readonly string[] | null
  pendingCategoryProposal?: {
    categories: readonly string[]
    proposerPlayerId: string
    votes: readonly { playerId: string; vote: "pending" | "accepted" | "rejected" }[]
    createdAt: string
  } | null
  rotationOrder: readonly string[]
  rotationIndex: number
  currentChallengerPlayerId: string | null
  winnerPlayerId: string | null
  currentRound: Round | null
  roundHistory: readonly Round[]
  version: number
  spotId: string | null
  scheduledStartAt: Date | null
  timezone: string | null
  locationRadiusMeters: number | null
  locationMaxAccuracyMeters: number | null
  locationVerificationTtlSeconds: number | null
  weatherForecastIcon?: string | null
  weatherObservedIcon?: string | null
  weatherConfirmed?: boolean | null
  weatherForecastDescription?: string | null
  weatherForecastTemp?: number | null
  weatherReportedAt?: Date | null
}

export type DomainErrorCode =
  | "INVALID_TRANSITION"
  | "NOT_AUTHORIZED"
  | "STALE_VERSION"
  | "PLAYER_NOT_ELIGIBLE"
  | "DUPLICATE_ATTEMPT"
  | "NO_COMPATIBLE_TRICK"
  | "INVALID_INPUT"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_REUSE"
  | "IDENTITY_CONFLICT"
  | "RATE_LIMITED"

export class GameDomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "GameDomainError"
  }
}
