import { describe, expect, it } from "vitest"
import {
  matchDateLine,
  matchMetaLine,
  matchModeLabel,
  matchStatusLabel,
  matchStatusTone,
  spotTypeLabel,
} from "@/lib/games/match-labels"

describe("matchStatusLabel", () => {
  it.each([
    ["training", "lobby", "Not started"],
    ["training", "active", "In progress"],
    ["training", "complete", "Finished"],
    // A rider ending their own training is stored as cancelled.
    ["training", "cancelled", "Finished"],
    ["challenge", "lobby", "Waiting for riders"],
    ["challenge", "active", "In progress"],
    ["challenge", "complete", "Finished"],
    ["challenge", "cancelled", "Ended early"],
  ] as const)("%s / %s → %s", (mode, status, label) => {
    expect(matchStatusLabel({ mode, status })).toBe(label)
  })
})

describe("matchStatusTone", () => {
  it("groups statuses into live, waiting and done", () => {
    expect(matchStatusTone({ status: "active" })).toBe("live")
    expect(matchStatusTone({ status: "lobby" })).toBe("waiting")
    expect(matchStatusTone({ status: "complete" })).toBe("done")
    expect(matchStatusTone({ status: "cancelled" })).toBe("done")
  })
})

describe("matchMetaLine", () => {
  it("names the mode, spot and spot type without ids", () => {
    expect(matchMetaLine({ mode: "challenge", spotLabel: "Downtown Plaza", nextSpotType: "rails" }))
      .toBe("Battle · Downtown Plaza · Rails")
    expect(matchMetaLine({ mode: "challenge", spotLabel: null, nextSpotType: "manual_pads" }))
      .toBe("Battle · Registered spot · Manual pads")
    expect(matchMetaLine({ mode: "training", spotLabel: null, nextSpotType: "ledges" }))
      .toBe("Training · Ledges")
  })

  it("labels modes and spot types", () => {
    expect(matchModeLabel("training")).toBe("Training")
    expect(matchModeLabel("challenge")).toBe("Battle")
    expect(spotTypeLabel("quarter-pipe")).toBe("Quarter pipe")
  })
})

describe("matchDateLine", () => {
  const updatedAt = "2026-11-03T12:00:00Z"

  it("says when a finished game was played", () => {
    expect(matchDateLine({ status: "complete", scheduledStartAt: null, updatedAt }, "en-US"))
      .toBe("Played Nov 3")
  })

  it("shows the scheduled start for a lobby", () => {
    const line = matchDateLine(
      { status: "lobby", scheduledStartAt: "2026-11-10T12:00:00Z", updatedAt },
      "en-US",
    )
    expect(line.startsWith("Starts Nov 10")).toBe(true)
  })

  it("says when a running game last moved", () => {
    expect(matchDateLine({ status: "active", scheduledStartAt: null, updatedAt }, "en-US"))
      .toBe("Updated Nov 3")
  })
})
