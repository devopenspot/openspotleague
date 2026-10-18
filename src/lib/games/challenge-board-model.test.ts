import { describe, expect, it } from "vitest"
import type { GameState, GameStage } from "@/lib/schemas/game"
import { buildChallengeBoardStages, stageRoundResult } from "./challenge-board-model"

describe("challenge board model", () => {
  it("returns persisted stages without appending a synthetic future stage", () => {
    const game = {
      status: "active",
      currentRound: { sequence: 1, status: "challenge_open" },
      stageLedger: [
        {
          id: "round-1",
          sequence: 1,
          status: "challenge_open",
        },
      ],
    } as unknown as GameState

    const stages = buildChallengeBoardStages(game)

    expect(stages).toHaveLength(1)
    expect(stages[0]?.kind).toBe("stage")
    expect(stages[0]?.stage.id).toBe("round-1")
  })

  it("returns no stages before the first persisted round", () => {
    const game = {
      status: "lobby",
      currentRound: null,
      stageLedger: [],
    } as unknown as GameState

    expect(buildChallengeBoardStages(game)).toEqual([])
  })
})

describe("stageRoundResult", () => {
  it("uses the challenger result as the primary signal", () => {
    const stage = {
      challengerResult: "landed",
      challengeOutcome: "established",
    } as unknown as GameStage
    expect(stageRoundResult(stage)).toBe("landed")

    const missed = {
      challengerResult: "failed",
      challengeOutcome: "failed_to_establish",
    } as unknown as GameStage
    expect(stageRoundResult(missed)).toBe("failed")
  })

  it("derives failure from the round outcome while the challenger result is still pending", () => {
    const stage = {
      challengerResult: "pending",
      challengeOutcome: "failed_to_establish",
    } as unknown as GameStage
    expect(stageRoundResult(stage)).toBe("failed")
  })

  it("returns null while the round is in flight", () => {
    const stage = {
      challengerResult: "pending",
      challengeOutcome: null,
    } as unknown as GameStage
    expect(stageRoundResult(stage)).toBeNull()
  })
})
