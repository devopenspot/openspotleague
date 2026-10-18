import {
  PLAYER_LIMITS,
  type Attempt,
  type GameState,
  type Player,
  type Round,
  type GameDefinition,
  GameDomainError,
} from "@/lib/games/definitions"
import { identityMatches, type ActorIdentity } from "@/lib/games/guest"
import type { DisciplineSlug, GameMode, SpotTypeSnapshot, TrickCatalog, TrickLevel } from "@/lib/schemas/game"
import {
  hasCompatible,
  remainingCount,
  selectTrickForSpotType,
} from "./trick-selection"

export { remainingCount, selectTrickForSpotType }
export { selectAlternativeTrickForSpotType, selectTrickForCategories } from "./trick-selection"

export type EngineOptions = {
  idFactory?: () => string
  chooseRotation?: (playerIds: readonly string[]) => readonly string[]
  usedTrickIds?: readonly string[]
  catalog?: TrickCatalog
}

const defaultIdFactory = () => crypto.randomUUID()

function fail(code: ConstructorParameters<typeof GameDomainError>[0], message: string): never {
  throw new GameDomainError(code, message)
}

function bump(state: GameState, changes: Partial<GameState>): GameState {
  return { ...state, ...changes, version: state.version + 1 }
}

function activePlayers(state: GameState): Player[] {
  return state.players.filter((player) => player.status === "active")
}

function activeIds(state: GameState): string[] {
  return activePlayers(state).map((player) => player.id)
}

function verifiedActiveIds(state: GameState, verifiedPlayerIds: readonly string[]): string[] {
  const verified = new Set(verifiedPlayerIds)
  return activePlayers(state)
    .filter((player) => verified.has(player.id))
    .map((player) => player.id)
}

function allActivePlayersVerified(state: GameState, verifiedPlayerIds: readonly string[]): boolean {
  const verified = new Set(verifiedPlayerIds)
  return activePlayers(state).every((player) => verified.has(player.id))
}

function randomPermutation(playerIds: readonly string[]): string[] {
  const result = [...playerIds]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1)
    crypto.getRandomValues(random)
    const swapIndex = (random[0] ?? 0) % (index + 1)
    const current = result[index]
    result[index] = result[swapIndex] as string
    result[swapIndex] = current as string
  }
  return result
}

function assertPermutation(rotation: readonly string[], playerIds: readonly string[]): void {
  if (rotation.length !== playerIds.length || new Set(rotation).size !== playerIds.length ||
    rotation.some((playerId) => !playerIds.includes(playerId))) {
    fail("INVALID_INPUT", "Rotation must contain every eligible player exactly once")
  }
}

function assertCatalogForState(state: GameState, catalog: TrickCatalog): void {
  if (catalog.discipline !== state.disciplineSlug) {
    fail("INVALID_INPUT", "The trick catalog does not match the game discipline")
  }
}

function nextChallenger(state: GameState, eligibleIds: readonly string[]): { playerId: string; index: number } | null {
  const eligible = new Set(eligibleIds)
  for (let offset = 1; offset <= state.rotationOrder.length; offset += 1) {
    const index = (state.rotationIndex + offset) % state.rotationOrder.length
    const playerId = state.rotationOrder[index]
    if (playerId && eligible.has(playerId)) return { playerId, index }
  }
  return null
}

function snapshotsFor(state: GameState): readonly SpotTypeSnapshot[] {
  return state.availableSpotTypes.map((snapshot) => ({ ...snapshot }))
}

function freshRound(state: GameState, input: { challengerPlayerId: string; sequence: number; id: string; eligiblePlayerIds: readonly string[] }): Round {
  return {
    id: input.id,
    sequence: input.sequence,
    status: state.mode === "challenge" && input.eligiblePlayerIds.length === 0
      ? "verifying_location"
      : "selecting_spot_type",
    challengerPlayerId: input.challengerPlayerId,
    eligiblePlayerIds: [...input.eligiblePlayerIds],
    spotType: state.nextSpotType,
    spotTypeSnapshot: snapshotsFor(state),
    spotTypeChanged: false,
    spotTypeChangedByPlayerId: null,
    level: null,
    trick: null,
    challengerResult: "pending",
    requiredResponsePlayerIds: [],
    attempts: [],
    failedPlayerIds: [],
    challengeOutcome: null,
    leadRetained: false,
    blockedReason: null,
  }
}

function applyStoredChallengeSettings(state: GameState, round: Round, options: EngineOptions): Round {
  if (state.nextLevel === null || !options.catalog || !options.usedTrickIds) return round
  assertCatalogForState(state, options.catalog)

  const compatible = hasCompatible(options.catalog, state.nextSpotType, state.nextLevel, state.selectedCategories)
  if (!compatible) {
    return {
      ...round,
      spotType: state.nextSpotType,
      level: state.nextLevel,
      status: "no_compatible_trick",
      blockedReason: `No tricks are available for level ${state.nextLevel} at ${state.nextSpotType}`,
    }
  }

  const remaining = remainingCount(options.catalog, state.nextSpotType, state.nextLevel, state.selectedCategories, options.usedTrickIds)
  if (remaining === 0) {
    const nextLevel = state.nextLevel < 5 ? state.nextLevel + 1 : null
    const message = nextLevel
      ? `Exhausted level ${state.nextLevel} for ${state.nextSpotType} with selected categories — advance to level ${nextLevel}`
      : `Exhausted level ${state.nextLevel} for ${state.nextSpotType} — switch spot type or categories`
    return {
      ...round,
      spotType: state.nextSpotType,
      level: state.nextLevel,
      status: "no_compatible_trick",
      blockedReason: message,
    }
  }

  return {
    ...round,
    spotType: state.nextSpotType,
    level: state.nextLevel,
    trick: selectTrickForSpotType(options.catalog, state.nextSpotType, state.nextLevel, options.usedTrickIds, state.selectedCategories),
    status: round.status === "verifying_location" ? "verifying_location" : "challenge_open",
  }
}

export function createLobby(input: {
  id: string
  disciplineSlug: DisciplineSlug
  mode: GameMode
  ruleMode?: GameState["ruleMode"]
  gameFormat?: GameState["gameFormat"]
  trainingVariant?: GameState["trainingVariant"]
  createdBy: string | null
  creatorDisplayName: string
  players: readonly Player[]
  availableSpotTypes: readonly SpotTypeSnapshot[]
  initialSpotType: string
  initialLevel?: TrickLevel | null
  selectedCategories?: readonly string[] | null
  definition: GameDefinition
  catalog: TrickCatalog
  catalogId?: string | null
}): GameState {
  if (input.players.length < 1 || input.players.length > PLAYER_LIMITS.max) {
    fail("INVALID_INPUT", "A game requires between one and two players before it starts")
  }
  if (!input.availableSpotTypes.some((type) => type.slug === input.initialSpotType)) {
    fail("INVALID_INPUT", "The initial spot type is not available at the selected spot")
  }
  if (new Set(input.players.map((player) => player.id)).size !== input.players.length) {
    fail("INVALID_INPUT", "Players must have unique IDs")
  }
  if (input.definition.disciplineSlug !== input.disciplineSlug || input.catalog.discipline !== input.disciplineSlug) {
    fail("INVALID_INPUT", "Game definition and catalog must match the discipline")
  }
  if (!input.catalog.tricks.some((trick) => input.availableSpotTypes.some((type) =>
    trick.compatibleSpotTypes.includes(type.slug) && (!input.selectedCategories || input.selectedCategories.length === 0 || trick.categories.some((c) => input.selectedCategories!.some((sc) => sc.toLowerCase() === c.toLowerCase())))))) {
    fail("INVALID_INPUT", "The game has no compatible trick for any available spot type")
  }
  if (input.initialLevel !== undefined && input.initialLevel !== null && !hasCompatible(input.catalog, input.initialSpotType, input.initialLevel, input.selectedCategories)) {
    fail("NO_COMPATIBLE_TRICK", `No tricks are available for level ${input.initialLevel} at ${input.initialSpotType}`)
  }
  return {
    id: input.id,
    mode: input.mode,
    ruleMode: input.ruleMode ?? "flexible",
    gameFormat: input.gameFormat,
    trainingVariant: input.trainingVariant ?? "multiplayer",
    disciplineSlug: input.disciplineSlug,
    challengeKey: input.definition.challengeKey,
    gameName: input.definition.gameName,
    eliminationWord: input.definition.eliminationWord,
    wordLength: input.definition.wordLength,
    catalogId: input.catalogId ?? null,
    status: "lobby",
    createdBy: input.createdBy,
    creatorDisplayName: input.creatorDisplayName,
    players: input.players,
    availableSpotTypes: input.availableSpotTypes,
    initialSpotType: input.initialSpotType,
    nextSpotType: input.initialSpotType,
    nextLevel: input.initialLevel ?? null,
    selectedCategories: input.selectedCategories ? [...input.selectedCategories] : null,
    rotationOrder: [],
    rotationIndex: 0,
    currentChallengerPlayerId: null,
    winnerPlayerId: null,
    currentRound: null,
    roundHistory: [],
    version: 0,
    spotId: null,
    scheduledStartAt: null,
    timezone: null,
    locationRadiusMeters: null,
    locationMaxAccuracyMeters: null,
    locationVerificationTtlSeconds: null,
  }
}

export function startGame(
  state: GameState,
  input: {
    actorUserId: string
    verifiedPlayerIds: readonly string[]
    now: Date
    scheduledStartAt: Date | null
    allowEarlyStart?: boolean
  },
  options: EngineOptions = {},
): GameState {
  if (state.status !== "lobby") fail("INVALID_TRANSITION", "Only a lobby can start")
  if (input.actorUserId !== state.createdBy) fail("NOT_AUTHORIZED", "Only the creator can start the game")
  if (state.mode === "challenge") {
    if (!input.scheduledStartAt) fail("INVALID_INPUT", "A challenge game requires a scheduled start")
    const graceEnd = input.scheduledStartAt.getTime() + 15 * 60 * 1000
    if (
      (input.now.getTime() < input.scheduledStartAt.getTime() && !input.allowEarlyStart) ||
      input.now.getTime() > graceEnd
    ) {
      fail("INVALID_TRANSITION", "The game is outside its scheduled start window")
    }
    if (!allActivePlayersVerified(state, input.verifiedPlayerIds)) fail("INVALID_TRANSITION", "Every joined player must be verified")
  }
  if (state.players.length < PLAYER_LIMITS.min) fail("INVALID_INPUT", "A game requires at least two players")
  const eligibleIds = state.mode === "challenge"
    ? verifiedActiveIds(state, input.verifiedPlayerIds)
    : activeIds(state)
  if (eligibleIds.length < PLAYER_LIMITS.min) {
    fail(state.mode === "challenge" ? "INVALID_TRANSITION" : "INVALID_INPUT", state.mode === "challenge"
      ? "At least two players must be verified"
      : "At least two active players are required")
  }
  const rotation = options.chooseRotation?.(eligibleIds) ?? randomPermutation(eligibleIds)
  assertPermutation(rotation, eligibleIds)
  const challenger = rotation[0]
  if (!challenger) fail("INVALID_TRANSITION", "A challenger could not be selected")
  return bump(state, {
    status: "active",
    rotationOrder: rotation,
    rotationIndex: 0,
    currentChallengerPlayerId: challenger,
    currentRound: applyStoredChallengeSettings(
      state,
      freshRound(state, { id: (options.idFactory ?? defaultIdFactory)(), sequence: 1, challengerPlayerId: challenger, eligiblePlayerIds: eligibleIds }),
      options,
    ),
  })
}

export function startSoloTraining(
  state: GameState,
  input: {
    actorUserId: string
  },
  options: EngineOptions = {},
): GameState {
  if (state.status !== "lobby") fail("INVALID_TRANSITION", "Only a lobby can start")
  if (input.actorUserId !== state.createdBy) fail("NOT_AUTHORIZED", "Only the creator can start the game")
  if (state.mode !== "training") fail("INVALID_TRANSITION", "Train Alone is only available in training games")
  if (state.trainingVariant !== "multiplayer") fail("INVALID_TRANSITION", "This game has already started training alone")

  const eligibleIds = activeIds(state)
  if (eligibleIds.length !== 1) fail("INVALID_INPUT", "Train Alone requires exactly one active rider")
  const challenger = eligibleIds[0]
  if (!challenger) fail("INVALID_TRANSITION", "A rider could not be selected")

  const rotation = [challenger]
  assertPermutation(rotation, eligibleIds)
  return bump(state, {
    trainingVariant: "solo",
    status: "active",
    rotationOrder: rotation,
    rotationIndex: 0,
    currentChallengerPlayerId: challenger,
    currentRound: applyStoredChallengeSettings(
      state,
      freshRound(state, {
        id: (options.idFactory ?? defaultIdFactory)(),
        sequence: 1,
        challengerPlayerId: challenger,
        eligiblePlayerIds: eligibleIds,
      }),
      options,
    ),
  })
}

function immediateTrickUpdate(_state: GameState, round: Round, spotType: string, level: TrickLevel | null, categories: readonly string[] | null, catalog: TrickCatalog, usedTrickIds: readonly string[]): Round {
  if (level === null) return { ...round, spotType, level, trick: null, status: "selecting_level" as const, blockedReason: null }
  if (!hasCompatible(catalog, spotType, level, categories)) {
    return { ...round, spotType, level, trick: null, status: "no_compatible_trick" as const, blockedReason: `No tricks are available for level ${level} at ${spotType}` }
  }
  const remaining = remainingCount(catalog, spotType, level, categories, usedTrickIds)
  if (remaining === 0) {
    const nextLevel = level < 5 ? level + 1 : null
    const message = nextLevel
      ? `Exhausted level ${level} for ${spotType} with selected categories — advance to level ${nextLevel}`
      : `Exhausted level ${level} for ${spotType} — switch spot type or categories`
    return { ...round, spotType, level, trick: null, status: "no_compatible_trick" as const, blockedReason: message }
  }
  const trick = selectTrickForSpotType(catalog, spotType, level, usedTrickIds, categories)
  return { ...round, spotType, level, trick, status: "challenge_open" as const, blockedReason: null }
}

export function selectSpotType(state: GameState, actor: ActorIdentity, spotType: string, catalog: TrickCatalog, usedTrickIds: readonly string[] = []): GameState {
  assertCatalogForState(state, catalog)
  const round = state.currentRound
  if (!round) {
    fail("INVALID_TRANSITION", "Spot type cannot be selected now")
  }
  const challenger = state.players.find((player) => player.id === state.currentChallengerPlayerId)
  if (!challenger || !identityMatches(actor, challenger)) fail("NOT_AUTHORIZED", "Only the current leader can select the spot type")
  if (!state.availableSpotTypes.some((type) => type.slug === spotType)) fail("INVALID_INPUT", "The spot type is not available")

  if (["challenge_open", "collecting_results"].includes(round.status)) {
    if (state.ruleMode === "flexible") {
      const level = state.nextLevel ?? round.level
      if (level !== null) {
        const nextRound = immediateTrickUpdate(state, round, spotType, level, state.selectedCategories ?? null, catalog, usedTrickIds)
        return bump(state, { nextSpotType: spotType, nextLevel: level, currentRound: nextRound })
      }
    }
    return bump(state, { nextSpotType: spotType })
  }
  if (!["selecting_spot_type", "no_compatible_trick"].includes(round.status)) {
    fail("INVALID_TRANSITION", "Spot type cannot be selected now")
  }
  const changed = spotType !== state.nextSpotType
  if (state.nextLevel !== null && !hasCompatible(catalog, spotType, state.nextLevel, state.selectedCategories)) {
    return bump(state, {
      nextSpotType: spotType,
      currentRound: {
        ...round,
        spotType,
        spotTypeChanged: changed,
        spotTypeChangedByPlayerId: changed ? challenger.id : null,
        status: "no_compatible_trick",
        blockedReason: `No tricks are available for level ${state.nextLevel} at ${spotType}`,
      },
    })
  }
  const reopened = round.status === "no_compatible_trick"
  return bump(state, {
    nextSpotType: spotType,
    nextLevel: reopened ? null : state.nextLevel,
    currentRound: {
      ...round,
      spotType,
      spotTypeChanged: changed,
      spotTypeChangedByPlayerId: changed ? challenger.id : null,
      level: reopened ? null : round.level,
      trick: reopened ? null : round.trick,
      blockedReason: null,
      status: "selecting_level",
    },
  })
}

export function selectLevel(
  state: GameState,
  actor: ActorIdentity,
  level: TrickLevel,
  usedTrickIds: readonly string[],
  catalog: TrickCatalog,
): GameState {
  assertCatalogForState(state, catalog)
  const round = state.currentRound
  if (!round) {
    fail("INVALID_TRANSITION", "Level cannot be selected now")
  }
  const challenger = state.players.find((player) => player.id === state.currentChallengerPlayerId)
  if (!challenger || !identityMatches(actor, challenger)) fail("NOT_AUTHORIZED", "Only the current leader can select the level")

  if (["challenge_open", "collecting_results"].includes(round.status)) {
    if (state.ruleMode === "flexible" && state.nextSpotType) {
      const spotType = state.nextSpotType ?? round.spotType
      const nextRound = immediateTrickUpdate(state, round, spotType, level, state.selectedCategories ?? null, catalog, usedTrickIds)
      return bump(state, { nextLevel: level, currentRound: nextRound })
    }
    return bump(state, { nextLevel: level })
  }
  if (!["selecting_level", "no_compatible_trick"].includes(round.status)) {
    fail("INVALID_TRANSITION", "Level cannot be selected now")
  }
  const compatible = hasCompatible(catalog, round.spotType, level, state.selectedCategories)
  if (!compatible) {
    return bump(state, {
      nextLevel: level,
      currentRound: {
        ...round,
        level,
        status: "no_compatible_trick",
        blockedReason: `No tricks are available for level ${level} at ${round.spotType}`,
      },
    })
  }
  const remaining = remainingCount(catalog, round.spotType, level, state.selectedCategories, usedTrickIds)
  if (remaining === 0) {
    const nextLevel = level < 5 ? level + 1 : null
    const message = nextLevel
      ? `Exhausted level ${level} for ${round.spotType} with selected categories — advance to level ${nextLevel}`
      : `Exhausted level ${level} for ${round.spotType} — switch spot type or categories`
    return bump(state, {
      nextLevel: level,
      currentRound: {
        ...round,
        level,
        status: "no_compatible_trick",
        blockedReason: message,
      },
    })
  }
  const trick = selectTrickForSpotType(catalog, round.spotType, level, usedTrickIds, state.selectedCategories)
  return bump(state, {
    nextLevel: level,
    currentRound: { ...round, level, trick, status: "challenge_open" },
  })
}

export function selectChallengeSettings(
  state: GameState,
  actor: ActorIdentity,
  spotType: string,
  level: TrickLevel,
  usedTrickIds: readonly string[],
  catalog: TrickCatalog,
): GameState {
  assertCatalogForState(state, catalog)
  const round = state.currentRound
  if (!round) fail("INVALID_TRANSITION", "Challenge settings cannot be selected now")

  const challenger = state.players.find((player) => player.id === state.currentChallengerPlayerId)
  if (!challenger || !identityMatches(actor, challenger)) {
    fail("NOT_AUTHORIZED", "Only the current leader can select challenge settings")
  }
  if (!state.availableSpotTypes.some((type) => type.slug === spotType)) {
    fail("INVALID_INPUT", "The selected spot type is not available")
  }

  const liveRound = ["challenge_open", "collecting_results"].includes(round.status)
  if (liveRound) {
    if (state.ruleMode !== "flexible") {
      fail("INVALID_TRANSITION", "Strict challenges keep the current line until the round resolves")
    }
    const nextRound = immediateTrickUpdate(state, round, spotType, level, state.selectedCategories ?? null, catalog, usedTrickIds)
    return bump(state, { nextSpotType: spotType, nextLevel: level, currentRound: nextRound })
  }
  if (![
    "selecting_spot_type",
    "selecting_level",
    "no_compatible_trick",
  ].includes(round.status)) {
    fail("INVALID_TRANSITION", "Challenge settings cannot be selected now")
  }

  const changed = spotType !== state.nextSpotType
  const compatible = hasCompatible(catalog, spotType, level, state.selectedCategories)
  if (!compatible) {
    return bump(state, {
      nextSpotType: spotType,
      nextLevel: level,
      currentRound: {
        ...round,
        spotType,
        spotTypeChanged: changed,
        spotTypeChangedByPlayerId: changed ? challenger.id : null,
        level,
        trick: null,
        status: "no_compatible_trick",
        blockedReason: `No tricks are available for level ${level} at ${spotType}`,
      },
    })
  }

  const remaining = remainingCount(catalog, spotType, level, state.selectedCategories, usedTrickIds)
  if (remaining === 0) {
    const nextLevel = level < 5 ? level + 1 : null
    const message = nextLevel
      ? `Exhausted level ${level} for ${spotType} with selected categories — advance to level ${nextLevel}`
      : `Exhausted level ${level} for ${spotType} — switch spot type or categories`
    return bump(state, {
      nextSpotType: spotType,
      nextLevel: level,
      currentRound: {
        ...round,
        spotType,
        spotTypeChanged: changed,
        spotTypeChangedByPlayerId: changed ? challenger.id : null,
        level,
        trick: null,
        status: "no_compatible_trick",
        blockedReason: message,
      },
    })
  }

  const trick = selectTrickForSpotType(catalog, spotType, level, usedTrickIds, state.selectedCategories)
  return bump(state, {
    nextSpotType: spotType,
    nextLevel: level,
    currentRound: {
      ...round,
      spotType,
      spotTypeChanged: changed,
      spotTypeChangedByPlayerId: changed ? challenger.id : null,
      level,
      trick,
      status: "challenge_open",
      blockedReason: null,
    },
  })
}

function normalizeCategoriesInput(input: readonly string[]): readonly string[] {
  return [...new Set(input.map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0))].sort()
}

export function proposeCategories(
  state: GameState,
  actor: ActorIdentity,
  categories: readonly string[],
  catalog: TrickCatalog,
  usedTrickIds: readonly string[] = [],
): GameState {
  if (state.ruleMode !== "flexible") fail("INVALID_TRANSITION", "Categories can only be changed in flexible mode")
  if (state.status !== "active" && state.status !== "lobby") fail("INVALID_TRANSITION", "Categories can only be changed in a lobby or active game")
  let challenger: Player | undefined
  if (state.currentChallengerPlayerId) {
    challenger = state.players.find((p) => p.id === state.currentChallengerPlayerId)
  } else if (state.createdBy) {
    challenger = state.players.find((p) => p.userId === state.createdBy)
  }
  if (!challenger) challenger = state.players[0]
  if (!challenger || !identityMatches(actor, challenger)) fail("NOT_AUTHORIZED", "Only the leader can propose categories")
  if (state.pendingCategoryProposal) fail("INVALID_TRANSITION", "A category proposal is already pending")
  const normalized = normalizeCategoriesInput(categories)
  if (normalized.length > 12) fail("INVALID_INPUT", "Too many categories")
  for (const c of normalized) if (c.length > 32) fail("INVALID_INPUT", "Category too long")
  assertCatalogForState(state, catalog)
  // Validate at least one trick exists for current nextSpotType/nextLevel with proposed categories (if level set)
  if (state.nextLevel !== null && state.nextSpotType) {
    const has = hasCompatible(catalog, state.nextSpotType, state.nextLevel, normalized.length > 0 ? normalized : null)
    if (!has) fail("NO_COMPATIBLE_TRICK", `No tricks for level ${state.nextLevel} at ${state.nextSpotType} with ${normalized.join(", ") || "All"}`)
  }
  const active = activePlayers(state)
  // Solo or single active: apply immediately (no wait) + immediate trick if live flexible
  if (active.length <= 1) {
    const nextCategories = normalized.length > 0 ? [...normalized] as readonly string[] : null
    const round = state.currentRound
    if (state.ruleMode === "flexible" && state.status === "active" && round && ["challenge_open", "collecting_results"].includes(round.status) && state.nextLevel !== null && state.nextSpotType) {
      const nextRound = immediateTrickUpdate(state, round, state.nextSpotType, state.nextLevel, nextCategories, catalog, usedTrickIds)
      return bump(state, { selectedCategories: nextCategories, pendingCategoryProposal: null, currentRound: nextRound })
    }
    return bump(state, { selectedCategories: nextCategories, pendingCategoryProposal: null })
  }
  const votes = active.map((p) => ({ playerId: p.id, vote: p.id === challenger.id ? "accepted" : "pending" as const }))
  const proposal = {
    categories: [...normalized] as readonly string[],
    proposerPlayerId: challenger.id,
    votes: votes as readonly { playerId: string; vote: "pending" | "accepted" | "rejected" }[],
    createdAt: new Date().toISOString(),
  }
  return bump(state, { pendingCategoryProposal: proposal })
}

export function voteCategoryProposal(
  state: GameState,
  actor: ActorIdentity,
  accept: boolean,
  catalog?: TrickCatalog,
  usedTrickIds: readonly string[] = [],
): GameState {
  if (state.ruleMode !== "flexible") fail("INVALID_TRANSITION", "Categories can only be changed in flexible mode")
  const proposal = state.pendingCategoryProposal
  if (!proposal) fail("INVALID_TRANSITION", "No category proposal is pending")
  const player = state.players.find((p) => identityMatches(actor, p))
  if (!player) fail("NOT_AUTHORIZED", "Only players can vote")
  if (player.status !== "active") fail("PLAYER_NOT_ELIGIBLE", "Only active players can vote")
  const entry = proposal.votes.find((v) => v.playerId === player.id)
  if (!entry) fail("PLAYER_NOT_ELIGIBLE", "Player is not part of proposal")
  if (entry.vote !== "pending") fail("INVALID_TRANSITION", "Player already voted")
  if (player.id === proposal.proposerPlayerId) fail("INVALID_TRANSITION", "Proposer cannot vote")
  if (!accept) {
    // Rejection clears proposal
    return bump(state, { pendingCategoryProposal: null })
  }
  const updatedVotes = proposal.votes.map((v) => v.playerId === player.id ? { ...v, vote: "accepted" as const } : v)
  const allAccepted = updatedVotes.every((v) => v.vote === "accepted")
  if (allAccepted) {
    const nextCategories = proposal.categories.length > 0 ? [...proposal.categories] as readonly string[] : null
    const round = state.currentRound
    if (catalog && state.ruleMode === "flexible" && state.status === "active" && round && ["challenge_open", "collecting_results"].includes(round.status) && state.nextLevel !== null && state.nextSpotType) {
      const nextRound = immediateTrickUpdate(state, round, state.nextSpotType, state.nextLevel, nextCategories, catalog, usedTrickIds)
      return bump(state, { selectedCategories: nextCategories, pendingCategoryProposal: null, currentRound: nextRound })
    }
    return bump(state, { selectedCategories: nextCategories, pendingCategoryProposal: null })
  }
  return bump(state, { pendingCategoryProposal: { ...proposal, votes: updatedVotes } })
}

export function submitChallengerResult(
  state: GameState,
  actor: ActorIdentity,
  result: "landed" | "failed",
  options: EngineOptions = {},
): GameState {
  const round = state.currentRound
  if (!round || round.status !== "challenge_open") fail("INVALID_TRANSITION", "The challenger result cannot be submitted now")
  const challenger = state.players.find((player) => player.id === round.challengerPlayerId)
  if (!challenger || !identityMatches(actor, challenger)) fail("NOT_AUTHORIZED", "Only the challenger can submit this result")
  const eligible = activePlayers(state)
    .filter((player) => round.eligiblePlayerIds.includes(player.id))
    .map((player) => player.id)
  if (!eligible.includes(challenger.id)) fail("PLAYER_NOT_ELIGIBLE", "The challenger is not verified for this round")
  if (state.trainingVariant === "solo") {
    if (state.mode !== "training" || eligible.length !== 1 || eligible[0] !== challenger.id) {
      fail("INVALID_TRANSITION", "Solo training requires one active challenger")
    }
    const nextRound = freshRound(state, {
      id: (options.idFactory ?? defaultIdFactory)(),
      sequence: round.sequence + 1,
      challengerPlayerId: challenger.id,
      eligiblePlayerIds: eligible,
    })
    return bump(state, {
      rotationOrder: [challenger.id],
      rotationIndex: 0,
      currentChallengerPlayerId: challenger.id,
      currentRound: applyStoredChallengeSettings(state, nextRound, options),
      roundHistory: [...state.roundHistory, {
        ...round,
        challengerResult: result,
        challengeOutcome: result === "landed" ? "resolved" : "failed_to_establish",
        status: "resolved",
        requiredResponsePlayerIds: [],
        leadRetained: true,
      }],
    })
  }
  if (result === "landed") {
    const required = eligible.filter((id) => id !== challenger.id)
    return bump(state, {
      currentRound: { ...round, challengerResult: result, challengeOutcome: "established", status: "collecting_results", requiredResponsePlayerIds: required },
    })
  }
  const next = nextChallenger(state, eligible)
  if (!next) fail("INVALID_TRANSITION", "There is no eligible next challenger")
  const nextRound = freshRound(state, {
    id: (options.idFactory ?? defaultIdFactory)(),
    sequence: round.sequence + 1,
    challengerPlayerId: next.playerId,
    eligiblePlayerIds: state.mode === "challenge" ? [] : activeIds(state),
  })
  return bump(state, {
    rotationIndex: next.index,
    currentChallengerPlayerId: next.playerId,
    currentRound: applyStoredChallengeSettings(state, nextRound, options),
    roundHistory: [...state.roundHistory, { ...round, challengerResult: "failed", challengeOutcome: "failed_to_establish", status: "resolved" }],
  })
}

export function submitResponse(
  state: GameState,
  actor: ActorIdentity,
  result: "landed" | "failed",
): GameState {
  const round = state.currentRound
  if (!round || round.status !== "collecting_results") fail("INVALID_TRANSITION", "Responses are not being collected")
  const player = state.players.find((candidate) => identityMatches(actor, candidate))
  if (!player || !round.requiredResponsePlayerIds.includes(player.id) || player.status !== "active") fail("PLAYER_NOT_ELIGIBLE", "This player cannot respond to the round")
  if (round.attempts.some((attempt) => attempt.playerId === player.id)) fail("DUPLICATE_ATTEMPT", "This player already submitted a result")
  const attempt: Attempt = { playerId: player.id, result }
  const attempts = [...round.attempts, attempt]
  if (attempts.length < round.requiredResponsePlayerIds.length) return bump(state, { currentRound: { ...round, attempts } })

  const failedPlayerIds = attempts.filter((item) => item.result === "failed").map((item) => item.playerId)
  const players = state.players.map((candidate) => {
    if (!failedPlayerIds.includes(candidate.id)) return candidate
    const failedAttempts = candidate.failedAttempts + 1
    const letter = state.eliminationWord[candidate.letters.length] ?? ""
    const letters = letter ? `${candidate.letters}${letter}` : candidate.letters
    return { ...candidate, letters, failedAttempts, status: letters.length >= state.eliminationWord.length ? "eliminated" : candidate.status }
  })
  const active = players.filter((candidate) => candidate.status === "active")
  const nextState: Partial<GameState> = {
    players,
    currentRound: { ...round, attempts, failedPlayerIds, challengeOutcome: "resolved", status: "resolved", leadRetained: true },
  }
  if (active.length <= 1) {
    return bump(state, { ...nextState, status: "complete", currentChallengerPlayerId: active[0]?.id ?? null })
  }
  return bump(state, nextState)
}

export function prepareNextRound(
  state: GameState,
  options: EngineOptions & { bumpVersion?: boolean } = {},
): GameState {
  const round = state.currentRound
  if (!round || round.status !== "resolved") fail("INVALID_TRANSITION", "The current round is not resolved")
  if (state.status !== "active") fail("INVALID_TRANSITION", "The game cannot prepare another round")
  const eligible = state.mode === "challenge"
    ? activePlayers(state).filter((player) => round.eligiblePlayerIds.includes(player.id)).map((player) => player.id)
    : activeIds(state)
  const advance = (changes: Partial<GameState>): GameState =>
    options.bumpVersion === false ? { ...state, ...changes } : bump(state, changes)
  if (state.mode === "challenge" && eligible.length < PLAYER_LIMITS.min) {
    return advance({ currentRound: { ...round, status: "paused" } })
  }

  const currentLeader = state.currentChallengerPlayerId
  const next = currentLeader && eligible.includes(currentLeader)
    ? { playerId: currentLeader, index: state.rotationOrder.indexOf(currentLeader) }
    : nextChallenger(state, eligible)
  if (!next || next.index < 0) fail("INVALID_TRANSITION", "There is no eligible challenger for the next round")

  const nextRound = freshRound(state, {
    id: (options.idFactory ?? defaultIdFactory)(),
    sequence: round.sequence + 1,
    challengerPlayerId: next.playerId,
    eligiblePlayerIds: state.mode === "challenge" ? [] : activeIds(state),
  })

  return advance({
    rotationIndex: next.index,
    currentChallengerPlayerId: next.playerId,
    currentRound: applyStoredChallengeSettings(state, nextRound, options),
    roundHistory: [...state.roundHistory, round],
  })
}
