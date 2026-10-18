import type { GameStage, GameState, TrainingVariant, TrickLevel } from "@/lib/schemas/game"

export type StageVisualState = "complete" | "current"

export type ChallengeStageView = {
  kind: "stage"
  stage: GameStage
  visualState: StageVisualState
}

export type ChallengeBoardStage = ChallengeStageView

const TERMINAL_STAGE_STATUSES = new Set(["resolved", "cancelled"])

export function buildChallengeBoardStages(game: GameState): ChallengeStageView[] {
  const currentSequence = game.currentRound?.sequence ?? Number.POSITIVE_INFINITY
  return game.stageLedger.map((stage) => ({
    kind: "stage" as const,
    stage,
    visualState:
      TERMINAL_STAGE_STATUSES.has(stage.status) || stage.sequence < currentSequence
        ? "complete" as const
        : "current" as const,
  }))
}

export type StageResult = "landed" | "failed" | null

/** Round-level outcome of a performed trick: did the trick get landed, or did the leader miss it. */
export function stageRoundResult(stage: GameStage): StageResult {
  if (stage.challengerResult === "landed" || stage.challengerResult === "failed") {
    return stage.challengerResult
  }
  if (stage.challengeOutcome === "failed_to_establish") return "failed"
  return null
}

export function stagePoints(stage: GameStage, playerId: string | null): number {
  if (!playerId) return 0
  return stage.scores.find((score) => score.playerId === playerId)?.points ?? 0
}

export function totalLedgerPoints(game: GameState, playerId: string | null): number {
  return game.stageLedger.reduce((total, stage) => total + stagePoints(stage, playerId), 0)
}

export function levelLabel(level: TrickLevel | null): string {
  if (level === 1) return "Basic"
  if (level === 2) return "Intermediate"
  if (level === 3) return "Advanced"
  return "Level pending"
}

export function stageOutcomeLabel(stage: GameStage, trainingVariant: TrainingVariant = "multiplayer"): string {
  if (stage.status === "no_compatible_trick") return "Needs A New Trick"
  if (stage.status === "paused") return "Paused — Waiting For Crew"
  if (stage.status === "cancelled") return "Session Closed"
  if (trainingVariant === "solo") {
    if (stage.status === "resolved" || stage.challengeOutcome === "resolved") {
      return stage.challengerResult === "landed" ? "Landed!" : "Missed"
    }
    if (stage.challengerResult === "failed" || stage.challengeOutcome === "failed_to_establish") return "Missed"
    if (stage.status === "challenge_open") return "Trick Ready — Send It!"
    return "Setting Next Trick…"
  }
  if (stage.challengeOutcome === "failed_to_establish") return "Leader Missed"
  if (stage.status === "resolved" || stage.challengeOutcome === "resolved") {
    const failed = stage.attempts.filter((attempt) => attempt.result === "failed").length
    return failed === 0 ? "Crew Cleared It!" : `${failed} Missed`
  }
  if (stage.challengeOutcome === "established") return "Your Turn — Go!"
  if (stage.status === "challenge_open") return "Trick Ready"
  if (stage.status === "verifying_location") return "Checking In Crew"
  return "Getting Ready…"
}
