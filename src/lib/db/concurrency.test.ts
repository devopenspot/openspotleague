import { describe, expect, it } from "vitest"
import { ConcurrencyGate, withDbConcurrency } from "./concurrency"

describe("database concurrency gates", () => {
  it("keeps in-flight work at or below the configured ceiling", async () => {
    const gate = new ConcurrencyGate(2)
    let active = 0
    let maximum = 0

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        gate.run(async () => {
          active += 1
          maximum = Math.max(maximum, active)
          await new Promise((resolve) => setTimeout(resolve, index % 2))
          active -= 1
        }),
      ),
    )

    expect(maximum).toBe(2)
    expect(gate.snapshot()).toEqual({ limit: 2, active: 0, queued: 0 })
  })

  it("preserves fan-out result order while bounding workers", async () => {
    const result = await withDbConcurrency(2, [
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return "first"
      },
      async () => "second",
      async () => "third",
    ])

    expect(result).toEqual(["first", "second", "third"])
  })
})
