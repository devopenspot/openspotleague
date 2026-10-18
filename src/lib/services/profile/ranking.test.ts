import { describe, expect, it } from "vitest"
import { rankForPoints } from "@/lib/services/profile/ranking"

describe("rider ranking", () => {
  it("derives labels from authoritative point thresholds", () => {
    expect(rankForPoints(0)).toBe("New Rider")
    expect(rankForPoints(143)).toBe("New Rider")
    expect(rankForPoints(144)).toBe("Street Learner")
    expect(rankForPoints(610)).toBe("Line Builder")
    expect(rankForPoints(1597)).toBe("Flow Rider")
    expect(rankForPoints(2584)).toBe("Blade Master")
  })
})
