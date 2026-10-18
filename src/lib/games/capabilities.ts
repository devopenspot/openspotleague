import type { GameState, LocationVerification, Player, Round } from "@/lib/games/definitions"
import { PLAYER_LIMITS } from "@/lib/games/definitions"
import { isLobbyReadyForStart } from "@/lib/games/lobby"
import type { GameFormat, TrainingVariant } from "@/lib/schemas/game"

type CapabilityPlayer = Pick<Player, "id" | "status">

type CapabilityRound = Pick<
  Round,
  | "status"
  | "challengerPlayerId"
  | "eligiblePlayerIds"
  | "requiredResponsePlayerIds"
  | "attempts"
> & {
  verifications: readonly LocationVerification[]
}

export type CapabilityGameState = Pick<
  GameState,
  "mode" | "status" | "scheduledStartAt" | "currentChallengerPlayerId"
> & {
  ruleMode?: "strict" | "flexible"
  gameFormat?: GameFormat
  trainingVariant?: TrainingVariant
  players: readonly CapabilityPlayer[]
  currentRound: CapabilityRound | null
}

export type GameViewer = {
  playerId: string | null
  isHost: boolean
  authenticated: boolean
}

export type GameCapabilities = {
  canJoin: boolean
  canLeave: boolean
  canStart: boolean
  canStartNow: boolean
  canTrainAlone: boolean
  canCancel: boolean
  canVerifyLocation: boolean
  canSelectSpotType: boolean
  canSelectLevel: boolean
  canSubmitChallenge: boolean
  canSubmitResponse: boolean
  canAdvanceToNextTrick: boolean
}

const SPOT_TYPE_STATUSES = new Set([
  "selecting_spot_type",
  "no_compatible_trick",
  "challenge_open",
  "collecting_results",
])

const LEVEL_STATUSES = new Set([
  "selecting_level",
  "no_compatible_trick",
  "challenge_open",
  "collecting_results",
])

function isChallengeViewerAllowed(game: CapabilityGameState, viewer: GameViewer): boolean {
  return game.mode === "training" || viewer.authenticated
}

function isWithinChallengeStartWindow(game: CapabilityGameState, now: Date): boolean {
  if (game.mode === "training") return true
  if (!game.scheduledStartAt) return false
  const start = game.scheduledStartAt.getTime()
  const current = now.getTime()
  return Number.isFinite(start) && current >= start && current <= start + 15 * 60 * 1000
}

function isWithinChallengeStartGrace(game: CapabilityGameState, now: Date): boolean {
  if (game.mode === "training") return true
  if (!game.scheduledStartAt) return false
  const start = game.scheduledStartAt.getTime()
  const current = now.getTime()
  return Number.isFinite(start) && current <= start + 15 * 60 * 1000
}

export function deriveGameCapabilities(
  game: CapabilityGameState,
  viewer: GameViewer,
  now: Date,
): GameCapabilities {
  const round = game.currentRound
  const viewerPlayer = game.players.find((player) => player.id === viewer.playerId)
  const isJoined = viewerPlayer !== undefined
  const isParticipant = viewerPlayer !== undefined && viewerPlayer.status !== "left"
  const isActive = viewerPlayer?.status === "active"
  const activePlayerCount = game.players.filter((player) => player.status === "active").length
  const verifiedPlayerIds = new Set(
    round?.verifications
      .filter((verification) => verification.status === "verified")
      .map((verification) => verification.playerId) ?? [],
  )
  const verifiedActiveCount = game.players.filter(
    (player) => player.status === "active" && verifiedPlayerIds.has(player.id),
  ).length
  const challengeViewerAllowed = isChallengeViewerAllowed(game, viewer)
  const isOpen = game.status === "lobby" || game.status === "active"
  const isActiveGame = game.status === "active" && round !== null
  const isTrickTraining =
    game.mode === "training" &&
    (game.gameFormat === undefined || game.gameFormat === "tricks")
  const isCurrentChallenger =
    isActive &&
    viewer.playerId !== null &&
    viewer.playerId === game.currentChallengerPlayerId &&
    viewer.playerId === round?.challengerPlayerId
  const isRoundEligible =
    game.mode === "training" ||
    (viewer.playerId !== null && Boolean(round?.eligiblePlayerIds.includes(viewer.playerId)))
  const canLeadRound = isActiveGame && challengeViewerAllowed && isCurrentChallenger && isRoundEligible
  const lobbyReady = isLobbyReadyForStart(
    game.mode,
    game.players.length,
    activePlayerCount,
    verifiedActiveCount,
  )
  const canStartBase =
    game.status === "lobby" &&
    viewer.isHost &&
    isActive &&
    challengeViewerAllowed &&
    round !== null &&
    lobbyReady

  return {
    canJoin:
      game.status === "lobby" &&
      !isJoined &&
      challengeViewerAllowed &&
      activePlayerCount < PLAYER_LIMITS.max,
    canLeave: game.status === "lobby" && isActive && !viewer.isHost && challengeViewerAllowed,
    canStart: canStartBase && isWithinChallengeStartWindow(game, now),
    canStartNow: canStartBase && isWithinChallengeStartGrace(game, now),
    canTrainAlone:
      game.status === "lobby" &&
      viewer.isHost &&
      isActive &&
      isTrickTraining &&
      game.trainingVariant !== "solo" &&
      activePlayerCount === 1 &&
      round !== null,
    canCancel:
      isOpen &&
      isParticipant &&
      challengeViewerAllowed &&
      (game.status === "lobby" || game.status === "active"),
    canVerifyLocation:
      game.mode === "challenge" &&
      challengeViewerAllowed &&
      isActive &&
      isOpen &&
      Boolean(round && ["verifying_location", "paused"].includes(round.status)),
    canSelectSpotType:
      canLeadRound &&
      SPOT_TYPE_STATUSES.has(round.status) &&
      (game.ruleMode === "flexible" || !["challenge_open", "collecting_results"].includes(round.status)),
    canSelectLevel:
      canLeadRound &&
      LEVEL_STATUSES.has(round.status) &&
      (game.ruleMode === "flexible" || !["challenge_open", "collecting_results"].includes(round.status)),
    canSubmitChallenge: canLeadRound && round.status === "challenge_open",
    canSubmitResponse:
      isActiveGame &&
      game.trainingVariant !== "solo" &&
      challengeViewerAllowed &&
      isActive &&
      isRoundEligible &&
      round.status === "collecting_results" &&
      viewer.playerId !== null &&
      round.requiredResponsePlayerIds.includes(viewer.playerId) &&
      !round.attempts.some((attempt) => attempt.playerId === viewer.playerId),
    canAdvanceToNextTrick:
      canLeadRound &&
      game.ruleMode === "flexible" &&
      ["challenge_open", "collecting_results"].includes(round.status),
  }
}
