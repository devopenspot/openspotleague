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

export const PLAYER_LIMITS = { min: 2, max: 2 } as const
export const START_GRACE_MINUTES = 15
export const DEFAULT_LOCATION_RADIUS_METERS = 250
export const DEFAULT_LOCATION_MAX_ACCURACY_METERS = 50
export const DEFAULT_LOCATION_VERIFICATION_TTL_SECONDS = 900
export const LEVEL_POINTS: Record<TrickLevel, number> = { 1: 5, 2: 8, 3: 13, 4: 21, 5: 34 }
export const WINNER_BONUS_POINTS = 34

export type GameDefinition = {
  sportPreference: "Roller" | "Skateboard" | "BMX" | "Scooter"
  disciplineSlug: DisciplineSlug
  challengeKey: ChallengeKey
  gameName: string
  eliminationWord: string
  wordLength: 4 | 5
  catalogPath: string
}

export const GAME_DEFINITIONS: Record<DisciplineSlug, GameDefinition> = {
  roller: {
    sportPreference: "Roller",
    disciplineSlug: "roller",
    challengeKey: "blade",
    gameName: "Play a Blade",
    eliminationWord: "BLADE",
    wordLength: 5,
    catalogPath: "src/data/tricks/roller.json",
  },
  skateboard: {
    sportPreference: "Skateboard",
    disciplineSlug: "skateboard",
    challengeKey: "skate",
    gameName: "Play a Skate",
    eliminationWord: "SKATE",
    wordLength: 5,
    catalogPath: "src/data/tricks/skateboard.json",
  },
  bmx: {
    sportPreference: "BMX",
    disciplineSlug: "bmx",
    challengeKey: "bike",
    gameName: "Play a Bike",
    eliminationWord: "BIKE",
    wordLength: 4,
    catalogPath: "src/data/tricks/bmx.json",
  },
  scooter: {
    sportPreference: "Scooter",
    disciplineSlug: "scooter",
    challengeKey: "scoot",
    gameName: "Play a Scoot",
    eliminationWord: "SCOOT",
    wordLength: 5,
    catalogPath: "src/data/tricks/scooter.json",
  },
}

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
