import { z } from "zod"

export const gameModeSchema = z.enum(["training", "challenge"])
export const ruleModeSchema = z.enum(["strict", "flexible"])
export const gameFormatSchema = z.enum(["tricks", "bmx_track_racing"])
export const trainingVariantSchema = z.enum(["multiplayer", "solo"])
export const racingLapCountSchema = z.number().int().min(1).max(20)
export const disciplineSlugSchema = z.enum(["roller", "skateboard", "bmx", "scooter"])
export const challengeKeySchema = z.enum(["blade", "skate", "bike", "scoot"])
export const challengeStartDelaySchema = z.union([
  z.literal(0),
  z.literal(3),
  z.literal(5),
])

export const weatherIconSchema = z.enum(["sunny", "partly_cloudy_day", "cloudy", "rain", "snow"])

export const gameStatusSchema = z.enum(["lobby", "active", "complete", "cancelled"])
export const roundStatusSchema = z.enum([
  "verifying_location",
  "selecting_spot_type",
  "selecting_level",
  "no_compatible_trick",
  "challenge_open",
  "collecting_results",
  "resolved",
  "paused",
  "cancelled",
])
export const playerStatusSchema = z.enum(["active", "eliminated", "left"])
export const verificationStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
  "expired",
  "unavailable",
])
export const trickLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
export const attemptResultSchema = z.enum(["pending", "landed", "failed"])

export const trickCategorySchema = z.string().trim().min(1).max(32)

export const trickDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  level: trickLevelSchema,
  discipline: disciplineSlugSchema,
  compatibleSpotTypes: z.array(z.string().min(1)).min(1),
  categories: z.array(trickCategorySchema).max(12).default([]).refine((cats) => new Set(cats.map((c) => c.toLowerCase())).size === cats.length, "Categories must be unique"),
})

export const trickCatalogSchema = z.object({
  version: z.string().optional(),
  discipline: disciplineSlugSchema,
  tricks: z.array(trickDefinitionSchema).min(1),
})

export const gameDefinitionSchema = z.object({
  sportPreference: z.enum(["Roller", "Skateboard", "BMX", "Scooter"]),
  disciplineSlug: disciplineSlugSchema,
  challengeKey: challengeKeySchema,
  gameName: z.string().min(1),
  eliminationWord: z.string().regex(/^[A-Z]+$/),
  wordLength: z.union([z.literal(4), z.literal(5)]),
  catalogPath: z.string().min(1),
}).superRefine((definition, context) => {
  if (definition.wordLength !== definition.eliminationWord.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["wordLength"],
      message: "wordLength must equal the elimination word length",
    })
  }
})

export const spotTypeSnapshotSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int(),
}).strict()

export const gameCreationSpotTypeSchema = spotTypeSnapshotSchema.extend({
  levels: z.array(trickLevelSchema).min(1),
}).strict()

export const gameCreationOptionsSchema = z.object({
  disciplineSlug: disciplineSlugSchema,
  spotTypes: z.array(gameCreationSpotTypeSchema),
  categories: z.array(trickCategorySchema).default([]),
  tricks: z.array(trickDefinitionSchema).default([]),
}).strict()

const wireDateSchema = z.string().datetime({ offset: true })

export const gamePlayerSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1).nullable(),
  displayName: z.string().min(1),
  seatOrder: z.number().int().nonnegative(),
  letters: z.string(),
  failedAttempts: z.number().int().nonnegative(),
  status: playerStatusSchema,
}).strict()

export const gameRoundSchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  status: roundStatusSchema,
  challengerPlayerId: z.string().min(1).nullable(),
  eligiblePlayerIds: z.array(z.string().min(1)),
  spotType: z.string().min(1),
  spotTypeSnapshot: z.array(spotTypeSnapshotSchema),
  spotTypeChanged: z.boolean(),
  spotTypeChangedByPlayerId: z.string().min(1).nullable(),
  trickId: z.string().min(1).nullable(),
  trickName: z.string().min(1).nullable(),
  trickDescription: z.string().min(1).nullable(),
  trickLevel: trickLevelSchema.nullable(),
  trickDisciplineSnapshot: disciplineSlugSchema.nullable(),
  blockedReason: z.string().nullable(),
  availableAlternatives: z.array(z.object({
    spotType: z.string().min(1),
    level: trickLevelSchema,
  }).strict()).optional(),
  challengerResult: attemptResultSchema,
  challengeOutcome: z.enum(["established", "failed_to_establish", "resolved"]).nullable(),
  requiredResponsePlayerIds: z.array(z.string().min(1)),
  attempts: z.array(z.object({
    playerId: z.string().min(1),
    result: z.enum(["landed", "failed"]),
    submittedAt: wireDateSchema,
  }).strict()),
  verifications: z.array(z.object({
    playerId: z.string().min(1),
    status: verificationStatusSchema,
    distanceMeters: z.number().finite().nonnegative().nullable(),
    accuracyMeters: z.number().finite().positive().nullable(),
    verifiedAt: wireDateSchema.nullable(),
    expiresAt: wireDateSchema.nullable(),
  }).strict()),
}).strict()

export const scoreEventTypeSchema = z.enum([
  "challenger_landed",
  "response_landed",
])

export const gameStageSchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  status: roundStatusSchema,
  challengerPlayerId: z.string().min(1).nullable(),
  spotType: z.string().min(1),
  trickId: z.string().min(1).nullable(),
  trickName: z.string().min(1).nullable(),
  trickLevel: trickLevelSchema.nullable(),
  challengerResult: attemptResultSchema,
  challengeOutcome: z.enum(["established", "failed_to_establish", "resolved"]).nullable(),
  leadRetained: z.boolean(),
  attempts: z.array(z.object({
    playerId: z.string().min(1),
    result: z.enum(["landed", "failed"]),
  }).strict()),
  scores: z.array(z.object({
    playerId: z.string().min(1),
    points: z.number().int().nonnegative(),
    eventTypes: z.array(scoreEventTypeSchema).min(1),
  }).strict()),
}).strict()

export const gameHistoryAttemptSchema = z.object({
  roundId: z.string().min(1),
  playerId: z.string().min(1),
  result: z.enum(["landed", "failed"]),
  submittedAt: wireDateSchema,
}).strict()

export const gameHistoryScoreEventSchema = z.object({
  roundId: z.string().min(1).nullable(),
  playerId: z.string().min(1),
  eventType: z.enum(["challenger_landed", "response_landed", "winner_bonus"]),
  points: z.number().int().nonnegative(),
  trickLevel: trickLevelSchema.nullable(),
  createdAt: wireDateSchema,
}).strict()

export const gameHistoryRaceLapSchema = z.object({
  playerId: z.string().min(1),
  lap: z.number().int().positive(),
  milliseconds: z.number().int().positive(),
  submittedAt: wireDateSchema,
}).strict()

export const gameHistoryResponseSchema = z.object({
  rounds: z.array(gameStageSchema),
  attempts: z.array(gameHistoryAttemptSchema),
  scoreEvents: z.array(gameHistoryScoreEventSchema),
  raceLaps: z.array(gameHistoryRaceLapSchema),
  nextRoundCursor: z.string().min(1).nullable(),
  nextLapCursor: z.string().min(1).nullable(),
}).strict()

export const gameStateSchema = z.object({
  id: z.string().min(1),
  createdBy: z.string().min(1).nullable(),
  creatorDisplayName: z.string().min(1),
  status: gameStatusSchema,
  version: z.number().int().nonnegative(),
  shareCode: z.string().min(1),
  mode: gameModeSchema,
  ruleMode: ruleModeSchema,
  gameFormat: gameFormatSchema.optional(),
  trainingVariant: trainingVariantSchema,
  lapCount: z.number().int().min(1).max(20).nullable().optional(),
  ghostMode: z.boolean().optional(),
  lapTimes: z.array(z.object({ playerId: z.string().min(1), lap: z.number().int().positive(), milliseconds: z.number().int().positive() }).strict()).optional(),
  disciplineSlug: disciplineSlugSchema,
  challengeKey: challengeKeySchema,
  gameName: z.string().min(1),
  eliminationWord: z.string().regex(/^[A-Z]+$/),
  wordLength: z.union([z.literal(4), z.literal(5)]),
  catalogId: z.string().min(1).nullable(),
  spotId: z.string().min(1).nullable(),
  scheduledStartAt: wireDateSchema.nullable(),
  timezone: z.string().min(1).nullable(),
  locationRadiusMeters: z.number().finite().positive().nullable(),
   nextSpotType: z.string().min(1),
   nextLevel: trickLevelSchema.nullable(),
   selectedCategories: z.array(trickCategorySchema).nullable().optional(),
   pendingCategoryProposal: z.object({
     categories: z.array(trickCategorySchema),
     proposerPlayerId: z.string().min(1),
     votes: z.array(z.object({ playerId: z.string().min(1), vote: z.enum(["pending", "accepted", "rejected"]) }).strict()),
     createdAt: wireDateSchema,
   }).nullable().optional(),
   availableSpotTypes: z.array(spotTypeSnapshotSchema),
  currentChallengerPlayerId: z.string().min(1).nullable(),
  winnerPlayerId: z.string().min(1).nullable(),
  rotationIndex: z.number().int().nonnegative(),
  viewerPlayerId: z.string().min(1).nullable(),
  viewerPoints: z.number().int().nonnegative().nullable(),
  winnerBonus: z.object({
    playerId: z.string().min(1),
    points: z.number().int().nonnegative(),
  }).strict().nullable(),
  viewerIsHost: z.boolean(),
  players: z.array(gamePlayerSchema),
  currentRound: gameRoundSchema.nullable(),
  stageLedger: z.array(gameStageSchema),
  weatherForecastIcon: weatherIconSchema.nullable().optional(),
  weatherObservedIcon: weatherIconSchema.nullable().optional(),
  weatherConfirmed: z.boolean().nullable().optional(),
  weatherForecastDescription: z.string().nullable().optional(),
  weatherForecastTemp: z.number().int().nullable().optional(),
  weatherReportedAt: wireDateSchema.nullable().optional(),
}).strict()

export const gameMutationResponseSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  status: z.union([gameStatusSchema, verificationStatusSchema]).optional(),
  reason: z.enum(["too_far", "low_accuracy"]).nullable().optional(),
  trickId: z.string().min(1).nullable().optional(),
  trick: trickDefinitionSchema.optional(),
}).strict()

export const gameListItemSchema = z.object({
  id: z.string().min(1),
  status: gameStatusSchema,
  shareCode: z.string().min(1),
  mode: gameModeSchema,
  disciplineSlug: disciplineSlugSchema,
  gameName: z.string().min(1),
  spotId: z.string().min(1).nullable(),
  scheduledStartAt: wireDateSchema.nullable(),
  nextSpotType: z.string().min(1),
  version: z.number().int().nonnegative(),
  updatedAt: wireDateSchema,
}).strict()

export const gameListResponseSchema = z.array(gameListItemSchema)

export const openTrainingGameSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  status: z.enum(["lobby", "active"]),
  mode: z.literal("training"),
  disciplineSlug: disciplineSlugSchema,
  gameName: z.string().min(1),
  nextSpotType: z.string().min(1),
  updatedAt: wireDateSchema,
}).strict()

export const openTrainingGamesResponseSchema = z.array(openTrainingGameSchema)

function validateCreateFormat(input: {
  disciplineSlug: DisciplineSlug
  gameFormat: GameFormat
  ruleMode?: RuleMode
  lapCount?: number
  ghostMode?: boolean
  spotType?: string
  level?: TrickLevel
}, context: z.RefinementCtx) {
  if (input.gameFormat === "bmx_track_racing" && input.disciplineSlug !== "bmx") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["gameFormat"], message: "Racing games are only available for BMX" })
  }
  if (input.gameFormat === "bmx_track_racing" && input.lapCount === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["lapCount"], message: "Racing games require a lap count" })
  }
  if (input.gameFormat === "tricks" && input.spotType === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["spotType"], message: "Trick games require a starting spot type" })
  }
  if (input.gameFormat === "tricks" && input.level === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["level"], message: "Trick games require a starting level" })
  }
  if (input.gameFormat !== "bmx_track_racing" && (input.lapCount !== undefined || input.ghostMode !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["gameFormat"], message: "Lap and ghost settings require racing format" })
  }
  if (input.gameFormat === "bmx_track_racing" && input.ruleMode !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["ruleMode"], message: "Strict and flexible rules apply only to trick games" })
  }
  if (input.gameFormat === "bmx_track_racing" && input.spotType !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["spotType"], message: "Spot type is only available for trick games" })
  }
  if (input.gameFormat === "bmx_track_racing" && input.level !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["level"], message: "Trick level is only available for trick games" })
  }
}

const weatherFields = {
  weatherForecastIcon: weatherIconSchema.optional(),
  weatherObservedIcon: weatherIconSchema.optional(),
  weatherConfirmed: z.boolean().optional(),
  weatherForecastDescription: z.string().max(200).optional(),
  weatherForecastTemp: z.number().int().min(-100).max(100).nullable().optional(),
}

function validateWeather(
  input: {
    spotId?: string
    weatherForecastIcon?: string
    weatherObservedIcon?: string
    weatherConfirmed?: boolean
  },
  context: z.RefinementCtx,
) {
  if (!input.spotId) {
    if (input.weatherForecastIcon !== undefined || input.weatherConfirmed !== undefined || input.weatherObservedIcon !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["weatherForecastIcon"], message: "Weather can only be reported when a spot is attached" })
    }
    return
  }
  if (input.weatherForecastIcon === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["weatherForecastIcon"], message: "Forecast weather is required when a spot is attached" })
  }
  if (input.weatherConfirmed === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["weatherConfirmed"], message: "Confirm whether the forecast matches the live weather" })
  }
  if (input.weatherConfirmed === false && !input.weatherObservedIcon) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["weatherObservedIcon"], message: "Select the correct live weather when the forecast is incorrect" })
  }
}

const categoriesField = {
  categories: z.array(trickCategorySchema).max(12).default([]).refine((cats) => new Set(cats.map((c) => c.toLowerCase())).size === cats.length, "Categories must be unique"),
}

export const createGameInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("challenge"),
    ruleMode: ruleModeSchema.optional(),
    gameFormat: gameFormatSchema.default("tricks"),
    lapCount: racingLapCountSchema.optional(),
    ghostMode: z.boolean().optional(),
    spotType: z.string().min(1).optional(),
    level: trickLevelSchema.optional(),
    ...categoriesField,
    disciplineSlug: disciplineSlugSchema,
    spotId: z.string().min(1),
    startDelayMinutes: challengeStartDelaySchema.default(3),
    timezone: z.string().min(1).max(100),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracyMeters: z.number().finite().positive(),
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().min(16).max(200),
    ...weatherFields,
  }).strict(),
  z.object({
    mode: z.literal("training"),
    ruleMode: ruleModeSchema.optional(),
    gameFormat: gameFormatSchema.default("tricks"),
    lapCount: racingLapCountSchema.optional(),
    ghostMode: z.boolean().optional(),
    spotType: z.string().min(1).optional(),
    level: trickLevelSchema.optional(),
    ...categoriesField,
    disciplineSlug: disciplineSlugSchema,
    spotId: z.string().min(1).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    accuracyMeters: z.number().finite().positive().optional(),
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().min(16).max(200),
    ...weatherFields,
  }).strict(),
]).superRefine((value, context) => {
  validateCreateFormat(value as Parameters<typeof validateCreateFormat>[0], context)
  validateWeather(value as Parameters<typeof validateWeather>[0], context)
  if (value.mode === "training" && value.spotId) {
    if (value.latitude === undefined || value.longitude === undefined || value.accuracyMeters === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["spotId"], message: "Location is required when a training spot is attached" })
    }
  }
  if (value.mode === "training" && !value.spotId) {
    if (value.latitude !== undefined || value.longitude !== undefined || value.accuracyMeters !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["spotId"], message: "Location requires a spot" })
    }
  }
})

export const joinGameInputSchema = z.object({
  shareCode: z.string().min(1).max(100),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(16).max(200),
}).strict()

export const gameMutationInputSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(16).max(200),
}).strict()

export const startGameMutationInputSchema = gameMutationInputSchema.extend({
  startNow: z.boolean().optional(),
}).strict()

export const alternativeTrickMutationInputSchema = gameMutationInputSchema.extend({
  excludedTrickIds: z.array(z.string().min(1)).min(1).max(4),
}).strict()

export const locationMutationInputSchema = gameMutationInputSchema.extend({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().positive(),
}).strict()

export const spotTypeMutationInputSchema = gameMutationInputSchema.extend({
  spotType: z.string().min(1),
}).strict()

export const levelMutationInputSchema = gameMutationInputSchema.extend({
  level: trickLevelSchema,
}).strict()

export const challengeSettingsMutationInputSchema = gameMutationInputSchema.extend({
  spotType: z.string().min(1),
  level: trickLevelSchema,
}).strict()

export const categoriesMutationInputSchema = gameMutationInputSchema.extend({
  categories: z.array(trickCategorySchema).max(12).refine((cats) => new Set(cats.map((c) => c.toLowerCase())).size === cats.length, "Categories must be unique"),
}).strict()

export const categoryProposalVoteInputSchema = gameMutationInputSchema.extend({
  accept: z.boolean(),
}).strict()

export const resultMutationInputSchema = gameMutationInputSchema.extend({
  result: z.enum(["landed", "failed"]),
}).strict()

export const guestIdentitySchema = z.object({
  token: z.string().min(32).max(200),
  name: z.string().trim().min(1).max(30).regex(/^[^\p{Cc}]+$/u),
})

export type WeatherIcon = z.infer<typeof weatherIconSchema>

export type GameMode = z.infer<typeof gameModeSchema>
export type RuleMode = z.infer<typeof ruleModeSchema>
export type GameFormat = z.infer<typeof gameFormatSchema>
export type TrainingVariant = z.infer<typeof trainingVariantSchema>
export type DisciplineSlug = z.infer<typeof disciplineSlugSchema>
export type ChallengeKey = z.infer<typeof challengeKeySchema>
export type GameStatus = z.infer<typeof gameStatusSchema>
export type RoundStatus = z.infer<typeof roundStatusSchema>
export type PlayerStatus = z.infer<typeof playerStatusSchema>
export type VerificationStatus = z.infer<typeof verificationStatusSchema>
export type TrickLevel = z.infer<typeof trickLevelSchema>
export type AttemptResult = z.infer<typeof attemptResultSchema>
export type TrickDefinition = z.infer<typeof trickDefinitionSchema>
export type TrickCatalog = z.infer<typeof trickCatalogSchema>
export type GameDefinitionSchema = z.infer<typeof gameDefinitionSchema>
export type SpotTypeSnapshot = z.infer<typeof spotTypeSnapshotSchema>
export type GameCreationOptions = z.infer<typeof gameCreationOptionsSchema>
export type GuestIdentity = z.infer<typeof guestIdentitySchema>
export type GamePlayer = z.infer<typeof gamePlayerSchema>
export type GameRound = z.infer<typeof gameRoundSchema>
export type ScoreEventType = z.infer<typeof scoreEventTypeSchema>
export type GameStage = z.infer<typeof gameStageSchema>
export type GameHistoryResponse = z.infer<typeof gameHistoryResponseSchema>
export type GameState = z.infer<typeof gameStateSchema>
export type GameMutationResponse = z.infer<typeof gameMutationResponseSchema>
export type GameListItem = z.infer<typeof gameListItemSchema>
export type GameListResponse = z.infer<typeof gameListResponseSchema>
export type OpenTrainingGame = z.infer<typeof openTrainingGameSchema>
export type OpenTrainingGamesResponse = z.infer<typeof openTrainingGamesResponseSchema>
