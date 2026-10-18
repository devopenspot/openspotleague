import { describe, expect, it } from "vitest"
import {
  computeLevelsForSpotAndCategories,
  countEligibleTricks,
  countTricksPerCategory,
  countTricksPerLevel,
} from "./trick-catalog-filters"

const tricks = [
  { level: 1, compatibleSpotTypes: ["rails", "flat"], categories: ["basics"] },
  { level: 2, compatibleSpotTypes: ["rails"], categories: ["Grinds"] },
  { level: 3, compatibleSpotTypes: ["bowl"], categories: ["basics", "vert"] },
  { level: 5, compatibleSpotTypes: ["rails"], categories: [] },
]

describe("computeLevelsForSpotAndCategories", () => {
  it("falls back to spot levels when the catalog is empty", () => {
    expect(
      computeLevelsForSpotAndCategories([], "rails", ["basics"], [2, 4]),
    ).toEqual([2, 4])
  })

  it("falls back to spot levels when no categories are selected", () => {
    expect(
      computeLevelsForSpotAndCategories(tricks, "rails", [], [1, 2]),
    ).toEqual([1, 2])
  })

  it("intersects spot type AND categories", () => {
    expect(
      computeLevelsForSpotAndCategories(tricks, "rails", ["basics"], [4]),
    ).toEqual([1])
    expect(
      computeLevelsForSpotAndCategories(tricks, "bowl", ["BASICS"], [4]),
    ).toEqual([3])
  })

  it("matches categories case-insensitively and sorts ascending", () => {
    expect(
      computeLevelsForSpotAndCategories(tricks, "rails", ["grinds"], [1]),
    ).toEqual([2])
    expect(
      computeLevelsForSpotAndCategories(tricks, "rails", ["nope"], [1]),
    ).toEqual([1])
  })

  it("excludes uncategorized tricks when categories are selected", () => {
    expect(
      computeLevelsForSpotAndCategories(tricks, "rails", ["grinds", "basics"], [1]),
    ).toEqual([1, 2])
  })

  it("falls back to spot levels when categories are empty (before consulting the catalog)", () => {
    expect(computeLevelsForSpotAndCategories(tricks, "rails", [], [9])).toEqual([
      9,
    ])
  })
})

describe("countTricksPerLevel", () => {
  it("seeds all five levels with zero and counts matches only", () => {
    const counts = countTricksPerLevel([], "rails", [])
    expect([...counts.entries()]).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ])
  })

  it("counts level ∧ spotType ∧ categories", () => {
    const all = countTricksPerLevel(tricks, "rails", ["grinds"])
    expect(all.get(2)).toBe(1)
    expect(all.get(1)).toBe(0)
    const none = countTricksPerLevel(tricks, "rails", ["basics"])
    expect(none.get(1)).toBe(1)
    expect(none.get(5)).toBe(0)
  })

  it("counts every trick on the spot type when categories are empty", () => {
    const counts = countTricksPerLevel(tricks, "rails", [])
    expect(counts.get(1)).toBe(1)
    expect(counts.get(2)).toBe(1)
    expect(counts.get(5)).toBe(1)
    expect(counts.get(3)).toBe(0)
  })
})

describe("countTricksPerCategory", () => {
  it("seeds every global category and trims/normalizes keys", () => {
    const counts = countTricksPerCategory(tricks, "bowl", 3, ["Basics", "vert", "grinds"])
    expect(counts.get("basics")).toBe(1)
    expect(counts.get("vert")).toBe(1)
    expect(counts.get("grinds")).toBe(0)
  })

  it("ignores tricks on other levels or spot types", () => {
    const counts = countTricksPerCategory(tricks, "rails", 5, ["basics"])
    expect(counts.get("basics")).toBe(0)
  })
})

describe("countEligibleTricks", () => {
  it("returns null for an empty catalog (unknown, not zero)", () => {
    expect(countEligibleTricks([], 1, "rails", [])).toBeNull()
  })

  it("counts the exact triple", () => {
    expect(countEligibleTricks(tricks, 1, "rails", ["basics"])).toBe(1)
    expect(countEligibleTricks(tricks, 2, "rails", ["grinds"])).toBe(1)
    expect(countEligibleTricks(tricks, 3, "rails", [])).toBe(0)
    expect(countEligibleTricks(tricks, 5, "rails", ["basics"])).toBe(0)
    expect(countEligibleTricks(tricks, 5, "rails", [])).toBe(1)
  })
})
