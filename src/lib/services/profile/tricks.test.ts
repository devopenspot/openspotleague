import { describe, expect, it } from "vitest"
import { tricksByLevel } from "@/lib/services/profile/profile"

describe("tricksByLevel", () => {
  it("fills every level from 1 to 5, including the ones with no landings", () => {
    expect(tricksByLevel([])).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
  })

  it("maps grouped rows, including levels 4 and 5 and string counts from Postgres", () => {
    expect(
      tricksByLevel([
        { level: 1, count: 7 },
        { level: 3, count: "2" },
        { level: 4, count: 1 },
        { level: 5, count: "3" },
      ]),
    ).toEqual({ 1: 7, 2: 0, 3: 2, 4: 1, 5: 3 })
  })

  it("drops null and out-of-range levels", () => {
    expect(
      tricksByLevel([
        { level: null, count: 4 },
        { level: 0, count: 1 },
        { level: 6, count: 1 },
        { level: 2, count: 1 },
      ]),
    ).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 })
  })
})
