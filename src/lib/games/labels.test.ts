import { describe, expect, it } from "vitest"
import { ATTEMPT_RESULT_LABEL, GAME_MODE_LABEL, GAME_STATUS_LABEL, weatherLabel } from "./labels"

describe("game labels", () => {
  it("names modes, statuses and results for riders", () => {
    expect(GAME_MODE_LABEL.challenge).toBe("Battle")
    expect(GAME_STATUS_LABEL.complete).toBe("Finished")
    expect(ATTEMPT_RESULT_LABEL.failed).toBe("Missed")
  })

  it("turns weather icon slugs into words", () => {
    expect(weatherLabel("partly_cloudy")).toBe("Partly cloudy")
    expect(weatherLabel("rain")).toBe("Rain")
  })
})
