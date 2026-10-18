import { describe, expect, it } from "vitest"
import {
  createGameInputSchema,
  alternativeTrickMutationInputSchema,
  gameDefinitionSchema,
  gameListResponseSchema,
  gameMutationResponseSchema,
  gameStateSchema,
  openTrainingGamesResponseSchema,
  challengeSettingsMutationInputSchema,
  trickCatalogSchema,
} from "@/lib/schemas/game"

const gameState = {
  id: "game-1",
  createdBy: "user-1",
  creatorDisplayName: "Rider",
  status: "active",
  version: 3,
  shareCode: "share-code",
  mode: "challenge",
  ruleMode: "strict",
  trainingVariant: "multiplayer",
  disciplineSlug: "bmx",
  challengeKey: "bike",
  gameName: "Play a Bike",
  eliminationWord: "BIKE",
  wordLength: 4,
  catalogId: "catalog-1",
  spotId: "spot-1",
  scheduledStartAt: "2030-01-01T12:00:00.000Z",
  timezone: "UTC",
  locationRadiusMeters: 250,
  nextSpotType: "rails",
  nextLevel: 2,
  availableSpotTypes: [{ slug: "rails", name: "Rails", sortOrder: 1 }],
  currentChallengerPlayerId: "player-1",
  winnerPlayerId: null,
  rotationIndex: 0,
  viewerPlayerId: "player-1",
  viewerPoints: 13,
  winnerBonus: null,
  viewerIsHost: true,
  players: [{
    id: "player-1",
    userId: "user-1",
    displayName: "Rider",
    seatOrder: 0,
    letters: "B",
    failedAttempts: 1,
    status: "active",
  }],
  currentRound: {
    id: "round-1",
    sequence: 1,
    status: "collecting_results",
    challengerPlayerId: "player-1",
    eligiblePlayerIds: ["player-1"],
    spotType: "rails",
    spotTypeSnapshot: [{ slug: "rails", name: "Rails", sortOrder: 1 }],
    spotTypeChanged: false,
    spotTypeChangedByPlayerId: null,
    trickId: "trick-1",
    trickName: "Grind",
    trickDescription: "Grind the rail",
    trickLevel: 2,
    trickDisciplineSnapshot: "bmx",
    blockedReason: null,
    challengerResult: "landed",
    challengeOutcome: "established",
    requiredResponsePlayerIds: ["player-1"],
    attempts: [{ playerId: "player-1", result: "landed", submittedAt: "2030-01-01T12:01:00.000Z" }],
    verifications: [{
      playerId: "player-1",
      status: "verified",
      distanceMeters: 12,
      accuracyMeters: 8,
      verifiedAt: "2030-01-01T12:00:00.000Z",
      expiresAt: "2030-01-01T12:15:00.000Z",
    }],
  },
  stageLedger: [{
    id: "round-1",
    sequence: 1,
    status: "collecting_results",
    challengerPlayerId: "player-1",
    spotType: "rails",
    trickId: "trick-1",
    trickName: "Grind",
    trickLevel: 2,
    challengerResult: "landed",
    challengeOutcome: "established",
    leadRetained: false,
    attempts: [{ playerId: "player-1", result: "landed" }],
    scores: [{ playerId: "player-1", points: 13, eventTypes: ["challenger_landed"] }],
  }],
}

describe("create game input", () => {
  it("accepts an explicit initial spot type and level", () => {
    const result = createGameInputSchema.safeParse({
      mode: "challenge",
      disciplineSlug: "roller",
      spotId: "spot-1",
      startDelayMinutes: 3,
      timezone: "America/Bogota",
      latitude: 4.711,
      longitude: -74.072,
      accuracyMeters: 12,
      spotType: "rails",
      level: 1,
      weatherForecastIcon: "sunny",
      weatherConfirmed: true,
      weatherObservedIcon: "sunny",
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.gameFormat).toBe("tricks")
  })

  it("accepts a challenge create request with explicit trick settings", () => {
    const result = createGameInputSchema.safeParse({
      mode: "challenge",
      disciplineSlug: "scooter",
      spotId: "spot-1",
      startDelayMinutes: 5,
      timezone: "America/Bogota",
      latitude: 4.711,
      longitude: -74.072,
      accuracyMeters: 12,
      spotType: "plaza",
      level: 1,
      weatherForecastIcon: "cloudy",
      weatherConfirmed: false,
      weatherObservedIcon: "rain",
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(true)
  })

  it("accepts a training create request without a physical spot or schedule", () => {
    const result = createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "roller",
      spotType: "rails",
      level: 1,
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(true)
  })

  it("accepts BMX racing settings with a global-best ghost", () => {
    const result = createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "bmx",
       gameFormat: "bmx_track_racing",
      lapCount: 5,
       ghostMode: true,
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(true)
  })

  it("accepts strict and flexible rules for trick games", () => {
    for (const ruleMode of ["strict", "flexible"] as const) {
      const result = createGameInputSchema.safeParse({
        mode: "training",
        disciplineSlug: "bmx",
        gameFormat: "tricks",
        ruleMode,
        spotType: "bmx-dirt",
        level: 1,
        expectedVersion: 0,
        idempotencyKey: "0123456789abcdef",
      })

      expect(result.success).toBe(true)
    }
  })

  it("rejects trick rules for BMX racing", () => {
    const result = createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "bmx",
      gameFormat: "bmx_track_racing",
      ruleMode: "flexible",
      lapCount: 3,
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(false)
  })

  it("rejects racing settings outside BMX or without required values", () => {
    expect(createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "skateboard",
       gameFormat: "bmx_track_racing",
      lapCount: 3,
       ghostMode: true,
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    }).success).toBe(false)
    expect(createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "bmx",
       gameFormat: "bmx_track_racing",
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    }).success).toBe(false)
  })

  it("requires trick settings for both modes", () => {
    expect(createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "roller",
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    }).success).toBe(false)
    expect(createGameInputSchema.safeParse({
      mode: "challenge",
      disciplineSlug: "roller",
      spotId: "spot-1",
      startDelayMinutes: 3,
      timezone: "America/Bogota",
      latitude: 4.711,
      longitude: -74.072,
      accuracyMeters: 12,
      level: 1,
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    }).success).toBe(false)
    expect(createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "bmx",
      gameFormat: "bmx_track_racing",
      lapCount: 3,
      spotType: "bmx-track",
      level: 1,
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    }).success).toBe(false)
  })

  it("rejects challenge-only fields on a training create request", () => {
    const result = createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "roller",
      spotId: "spot-1",
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(false)
  })

  it("rejects an unknown discipline", () => {
    const result = createGameInputSchema.safeParse({
      mode: "training",
      disciplineSlug: "surfing",
      expectedVersion: 0,
      idempotencyKey: "0123456789abcdef",
    })

    expect(result.success).toBe(false)
  })

  it("requires a share code when joining", () => {
    const result = createGameInputSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("shared game schemas", () => {
  it("parses a combined challenge settings mutation", () => {
    const mutation = {
      expectedVersion: 4,
      idempotencyKey: "challenge-settings-key-1234567890",
      spotType: "rails",
      level: 2,
    }

    expect(challengeSettingsMutationInputSchema.parse(mutation)).toEqual(mutation)
  })

  it("parses an alternative trick retrieval mutation", () => {
    const mutation = {
      expectedVersion: 4,
      idempotencyKey: "alternative-trick-key-1234567890",
      excludedTrickIds: ["current-trick", "alternative-one"],
    }

    expect(alternativeTrickMutationInputSchema.parse(mutation)).toEqual(mutation)
  })

  it("rejects malformed combined challenge settings", () => {
    expect(challengeSettingsMutationInputSchema.safeParse({
      expectedVersion: 4,
      idempotencyKey: "challenge-settings-key-1234567890",
      spotType: "",
      level: 4,
    }).success).toBe(false)
    expect(challengeSettingsMutationInputSchema.safeParse({
      expectedVersion: 4,
      idempotencyKey: "challenge-settings-key-1234567890",
      spotType: "rails",
      level: 2,
      extra: true,
    }).success).toBe(false)
  })

  it("requires a non-empty trick catalog", () => {
    const result = trickCatalogSchema.safeParse({ discipline: "roller", tricks: [] })
    expect(result.success).toBe(false)
  })

  it("requires the definition word length to match its word", () => {
    const result = gameDefinitionSchema.safeParse({
      sportPreference: "BMX",
      disciplineSlug: "bmx",
      challengeKey: "bike",
      gameName: "Play a Bike",
      eliminationWord: "BIKE",
      wordLength: 5,
      catalogPath: "src/data/tricks/bmx.json",
    })
    expect(result.success).toBe(false)
  })

  it("parses a complete game read projection", () => {
    expect(gameStateSchema.parse(gameState)).toEqual(gameState)
  })

  it("rejects unknown and invalid nested projection fields", () => {
    expect(gameStateSchema.safeParse({ ...gameState, internalSecret: true }).success).toBe(false)
    expect(gameStateSchema.safeParse({
      ...gameState,
      currentRound: { ...gameState.currentRound, trickLevel: 4 },
    }).success).toBe(true)
    expect(gameStateSchema.safeParse({
      ...gameState,
      currentRound: { ...gameState.currentRound, trickLevel: 6 },
    }).success).toBe(false)
  })

  it("parses mutation response variants strictly", () => {
    expect(gameMutationResponseSchema.parse({ id: "game-1", version: 4 })).toEqual({ id: "game-1", version: 4 })
    expect(gameMutationResponseSchema.parse({
      id: "game-1",
      version: 4,
      trick: {
        id: "trick-2",
        name: "Backside 180",
        description: "Rotate cleanly on the rail.",
        level: 1,
        discipline: "skateboard",
        compatibleSpotTypes: ["rails"],
      },
    }).trick?.id).toBe("trick-2")
    expect(gameMutationResponseSchema.safeParse({ id: "game-1", version: 4, status: "verified", reason: null }).success).toBe(true)
    expect(gameMutationResponseSchema.safeParse({ id: "game-1", version: 4, extra: true }).success).toBe(false)
  })

  it("parses user and open-training game lists", () => {
    expect(gameListResponseSchema.safeParse([{
      id: "game-1",
      status: "active",
      shareCode: "share-code",
      mode: "challenge",
      disciplineSlug: "bmx",
      gameName: "Play a Bike",
      spotId: "spot-1",
      scheduledStartAt: "2030-01-01T12:00:00.000Z",
      nextSpotType: "rails",
      version: 3,
      updatedAt: "2030-01-01T12:01:00.000Z",
    }]).success).toBe(true)
    expect(openTrainingGamesResponseSchema.safeParse([{
      id: "game-2",
      version: 0,
      status: "lobby",
      mode: "training",
      disciplineSlug: "roller",
      gameName: "Play a Blade",
      nextSpotType: "flat",
      updatedAt: "2030-01-01T12:01:00.000Z",
    }]).success).toBe(true)
    expect(openTrainingGamesResponseSchema.safeParse([{ id: "game-2", mode: "challenge" }]).success).toBe(false)
  })
})
