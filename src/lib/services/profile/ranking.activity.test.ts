import { describe, expect, it } from "vitest"
import { buildRiderActivityGrid } from "./ranking"

describe("buildRiderActivityGrid", () => {
  it("returns a complete zero-filled daily grid and aggregates events", () => {
    const grid = buildRiderActivityGrid(
      [
        { createdAt: "2026-08-10T03:00:00.000Z", points: 5 },
        { createdAt: "2026-08-10T08:00:00.000Z", points: 13 },
      ],
      new Date("2026-08-10T12:00:00.000Z"),
      3,
    )
    expect(grid).toHaveLength(3)
    expect(grid[2]).toEqual({ date: "2026-08-10", count: 2, points: 18 })
    expect(grid[0]?.count).toBe(0)
  })
})
