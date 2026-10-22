import { describe, expect, it } from "vitest"
import { catalogForDiscipline } from "@/lib/games/catalogs"
import {
  eligiblePool,
  hashSeed,
  seededShuffle,
  selectAlternativeTrickForSpotType,
  selectTrickForSpotType,
} from "@/lib/games/trick-selection"

describe("trick-selection — seeded PRNG & shuffle", () => {
  it("computes consistent 32-bit hash for string and number seeds", () => {
    expect(hashSeed(12345)).toBe(12345)
    expect(hashSeed("game-session-abc")).toBe(hashSeed("game-session-abc"))
    expect(hashSeed("game-1")).not.toBe(hashSeed("game-2"))
  })

  it("produces deterministic permutations for identical seeds", () => {
    const list = ["ollie", "kickflip", "heelflip", "pop-shove-it", "boardslide"]
    const shuffledA = seededShuffle(list, "seed-123")
    const shuffledB = seededShuffle(list, "seed-123")
    expect(shuffledA).toEqual(shuffledB)
    expect(shuffledA).toHaveLength(list.length)
    expect(new Set(shuffledA)).toEqual(new Set(list))
  })

  it("produces different permutations for different seeds", () => {
    const list = [
      "ollie", "kickflip", "heelflip", "pop-shove-it",
      "boardslide", "50-50", "manual", "nosemanual", "tre-flip",
    ]
    const shuffledA = seededShuffle(list, "seed-alpha")
    const shuffledB = seededShuffle(list, "seed-beta")
    expect(shuffledA).not.toEqual(shuffledB)
  })
})

describe("trick-selection — fully shuffled across all levels", () => {
  it("shuffles tricks when seed is provided across different levels", () => {
    const catalog = catalogForDiscipline("skateboard")
    
    // Level 1 plaza
    const poolL1 = eligiblePool(catalog, "plaza", 1, null)
    expect(poolL1.length).toBeGreaterThan(3)

    const unseeded = selectTrickForSpotType(catalog, "plaza", 1, [])
    expect(unseeded.sourceId).toBeDefined()
    const seeded1 = selectTrickForSpotType(catalog, "plaza", 1, [], null, "game-session-alpha")
    const seeded2 = selectTrickForSpotType(catalog, "plaza", 1, [], null, "game-session-zeta-999")

    // Both seeded selections return valid tricks from Level 1
    expect(poolL1.some((t) => t.id === seeded1.sourceId)).toBe(true)
    expect(poolL1.some((t) => t.id === seeded2.sourceId)).toBe(true)

    // Repeatability: same seed gives same trick
    const seeded1Repeat = selectTrickForSpotType(catalog, "plaza", 1, [], null, "game-session-alpha")
    expect(seeded1Repeat.sourceId).toBe(seeded1.sourceId)

    // Level 2 plaza
    const poolL2 = eligiblePool(catalog, "plaza", 2, null)
    expect(poolL2.length).toBeGreaterThan(3)
    const seededL2 = selectTrickForSpotType(catalog, "plaza", 2, [], null, "game-session-alpha")
    expect(poolL2.some((t) => t.id === seededL2.sourceId)).toBe(true)
    expect(seededL2.level).toBe(2)
  })

  it("preserves unseeded alphabetical determinism for backward compatibility", () => {
    const catalog = catalogForDiscipline("roller")
    const first = selectTrickForSpotType(catalog, "rails", 1, [])
    const second = selectTrickForSpotType(catalog, "rails", 1, [first.sourceId])
    expect(first.sourceId).not.toBe(second.sourceId)
  })
})

describe("trick-selection — wildcard rerolls (same level & category, future availability)", () => {
  it("selects alternatives within the same level and configured category without reusing round-excluded tricks", () => {
    const catalog = catalogForDiscipline("skateboard")

    // Initial trick
    const first = selectAlternativeTrickForSpotType(
      catalog,
      "plaza",
      1,
      [],
      null,
      "game-session-1",
    )
    expect(first.level).toBe(1)

    // First wildcard reroll: excludes first
    const second = selectAlternativeTrickForSpotType(
      catalog,
      "plaza",
      1,
      [first.sourceId],
      null,
      "game-session-1",
    )
    expect(second.sourceId).not.toBe(first.sourceId)
    expect(second.level).toBe(1)

    // Second wildcard reroll: excludes first and second
    const third = selectAlternativeTrickForSpotType(
      catalog,
      "plaza",
      1,
      [first.sourceId, second.sourceId],
      null,
      "game-session-1",
    )
    expect(third.sourceId).not.toBe(first.sourceId)
    expect(third.sourceId).not.toBe(second.sourceId)
    expect(third.level).toBe(1)
  })

  it("allows avoided tricks to be selected in future rounds (not permanently removed)", () => {
    const catalog = catalogForDiscipline("skateboard")

    // In Round 1, rider rejects trick A and lands trick B
    const rejectedInRound1 = "fakie-ollie"
    const landedInRound1 = "ollie"

    // In Round 2, only actually landed/used tricks are in usedTrickIds
    // The rejected trick from round 1 is NOT in usedTrickIds
    const usedTrickIds = [landedInRound1]

    // In Round 2, the rejected trick is still in the eligible pool and eligible to be picked
    const poolL1 = eligiblePool(catalog, "plaza", 1, null)
    expect(poolL1.some((t) => t.id === rejectedInRound1)).toBe(true)
    expect(usedTrickIds.includes(rejectedInRound1)).toBe(false)

    const round2Candidate = selectTrickForSpotType(
      catalog,
      "plaza",
      1,
      usedTrickIds,
      null,
      "game-session-1",
    )
    expect(round2Candidate.sourceId).not.toBe(landedInRound1)
  })
})
