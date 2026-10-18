import { describe, expect, it } from "vitest"
import {
  GAME_DEFINITIONS,
  LEVEL_POINTS,
  PLAYER_LIMITS,
  WINNER_BONUS_POINTS,
  challengeKeyForDiscipline,
  disciplineForChallengeKey,
  normalizeChallengeKey,
} from "@/lib/games/definitions"

describe("challenge key normalization", () => {
  it.each([
    ["blade", "blade"],
    ["Blade", "blade"],
    ["BLADE", "blade"],
    ["  blade  ", "blade"],
    ["skate", "skate"],
    ["Skate", "skate"],
    ["SKATE", "skate"],
    ["bike", "bike"],
    ["Bike", "bike"],
    ["BIKE", "bike"],
    ["scoot", "scoot"],
    ["Scoot", "scoot"],
    ["SCOOT", "scoot"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeChallengeKey(input)).toBe(expected)
  })

  it("applies Unicode NFC normalization", () => {
    expect(normalizeChallengeKey("scoot\u0301".normalize("NFD").replace("\u0301", ""))).toBe("scoot")
  })

  it("rejects unknown keys", () => {
    expect(normalizeChallengeKey("surf")).toBeNull()
    expect(normalizeChallengeKey("")).toBeNull()
  })

  it("resolves discipline from any casing", () => {
    expect(disciplineForChallengeKey("BLADE")).toBe("roller")
    expect(disciplineForChallengeKey("scoot")).toBe("scooter")
    expect(challengeKeyForDiscipline("scooter")).toBe("scoot")
  })
})

describe("game definitions", () => {
  it("defines all four sports with canonical values", () => {
    expect(GAME_DEFINITIONS.roller).toMatchObject({ challengeKey: "blade", gameName: "Play a Blade", eliminationWord: "BLADE", wordLength: 5 })
    expect(GAME_DEFINITIONS.skateboard).toMatchObject({ challengeKey: "skate", gameName: "Play a Skate", eliminationWord: "SKATE", wordLength: 5 })
    expect(GAME_DEFINITIONS.bmx).toMatchObject({ challengeKey: "bike", gameName: "Play a Bike", eliminationWord: "BIKE", wordLength: 4 })
    expect(GAME_DEFINITIONS.scooter).toMatchObject({ challengeKey: "scoot", gameName: "Play a Scoot", eliminationWord: "SCOOT", wordLength: 5 })
  })

  it("keeps word length equal to elimination word length", () => {
    for (const definition of Object.values(GAME_DEFINITIONS)) {
      expect(definition.wordLength).toBe(definition.eliminationWord.length)
    }
  })

  it("uses the normative scoring contract and 2-rider head-to-head limit", () => {
    expect(LEVEL_POINTS).toEqual({ 1: 5, 2: 8, 3: 13, 4: 21, 5: 34 })
    expect(WINNER_BONUS_POINTS).toBe(34)
    expect(PLAYER_LIMITS).toEqual({ min: 2, max: 2 })
  })
})
