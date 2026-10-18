import { describe, expect, it } from "vitest"
import {
  resolveChallengeSheetState,
  type ChallengeSheetState,
} from "./challenge-board-sheet"

describe("resolveChallengeSheetState", () => {
  const cases: [
    ChallengeSheetState,
    number,
    number,
    ChallengeSheetState,
  ][] = [
    ["collapsed", -80, 0, "expanded"],
    ["collapsed", 0, -600, "expanded"],
    ["expanded", 80, 0, "collapsed"],
    ["expanded", 0, 600, "collapsed"],
    ["collapsed", -20, 0, "collapsed"],
    ["expanded", 20, 0, "expanded"],
  ]

  it.each(cases)(
    "resolves %s with offset %s and velocity %s to %s",
    (current, offset, velocity, expected) => {
      expect(resolveChallengeSheetState(current, offset, velocity)).toBe(expected)
    },
  )
})
