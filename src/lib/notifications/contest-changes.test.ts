import { describe, expect, it } from "vitest"
import { detectContestChanges, type ContestChangeSnapshot } from "./contest-changes"

const BEFORE: ContestChangeSnapshot = {
  startAt: new Date("2026-12-01T00:00:00.000Z"),
  endAt: null,
  timezone: "America/New_York",
  submissionDeadlineAt: new Date("2026-12-10T00:00:00.000Z"),
  city: "Austin",
  address: "1 Main St",
  venue: null,
  countryCode: "US",
  location: { lat: 30.1, lon: -97.7 },
}

describe("detectContestChanges", () => {
  it("ignores untouched and identical values", () => {
    expect(detectContestChanges(BEFORE, {})).toEqual([])
    expect(
      detectContestChanges(BEFORE, {
        startAt: new Date(BEFORE.startAt.getTime()),
        city: "Austin",
        location: { lat: 30.1, lon: -97.7 },
      }),
    ).toEqual([])
  })

  it("reports schedule, location and deadline changes", () => {
    expect(
      detectContestChanges(BEFORE, {
        endAt: new Date("2026-12-02T00:00:00.000Z"),
        venue: "Skatepark",
        submissionDeadlineAt: new Date("2026-12-11T00:00:00.000Z"),
      }),
    ).toEqual(["schedule", "location", "deadline"])
  })

  it("treats a moved pin as a location change", () => {
    expect(detectContestChanges(BEFORE, { location: { lat: 30.2, lon: -97.7 } })).toEqual(["location"])
  })
})
