import { describe, expect, it } from "vitest"
import { projectGameAttempt } from "@/lib/services/games"

describe("game projections", () => {
  it("removes database-only attempt fields from the current-round payload", () => {
    const projected = projectGameAttempt({
      id: "attempt-1",
      roundId: "round-1",
      playerId: "player-1",
      result: "landed",
      submittedAt: new Date("2030-01-01T12:01:00.000Z"),
    })

    expect(projected).toEqual({
      playerId: "player-1",
      result: "landed",
      submittedAt: "2030-01-01T12:01:00.000Z",
    })
    expect(projected).not.toHaveProperty("id")
    expect(projected).not.toHaveProperty("roundId")
  })
})
