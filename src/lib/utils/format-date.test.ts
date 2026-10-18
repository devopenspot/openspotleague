import { describe, expect, it } from "vitest"
import { formatUtcDate } from "./format-date"

describe("formatUtcDate", () => {
  it("uses a stable locale and UTC date", () => {
    expect(formatUtcDate("2026-08-18T00:22:51.621Z")).toBe("8/18/2026")
  })

  it("preserves invalid date input", () => {
    expect(formatUtcDate("not-a-date")).toBe("not-a-date")
  })
})
