import { describe, expect, it } from "vitest"
import { isLobbyReadyForStart } from "@/lib/games/lobby"

describe("isLobbyReadyForStart", () => {
  it("requires two active riders for training games", () => {
    expect(isLobbyReadyForStart("training", 2, 1, 0)).toBe(false)
    expect(isLobbyReadyForStart("training", 3, 2, 0)).toBe(true)
  })

  it("does not count left riders as training participants", () => {
    expect(isLobbyReadyForStart("training", 4, 1, 0)).toBe(false)
  })

  it("requires all active challenge riders to be verified", () => {
    expect(isLobbyReadyForStart("challenge", 2, 2, 1)).toBe(false)
    expect(isLobbyReadyForStart("challenge", 2, 2, 2)).toBe(true)
  })

  it("requires two active challenge riders even when departed riders remain", () => {
    expect(isLobbyReadyForStart("challenge", 3, 1, 1)).toBe(false)
  })
})
