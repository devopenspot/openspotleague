import { describe, expect, it } from "vitest"
import { ConcurrencyGate, withDbConcurrency } from "./concurrency"
import { TimeoutError } from "./errors"

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

  it("runs nested work inside the outer slot instead of deadlocking", async () => {
    const gate = new ConcurrencyGate(1)

    const result = await gate.run(async () => {
      const inner = await gate.run(async () => "inner")
      return `${inner}+outer`
    })

    expect(result).toBe("inner+outer")
    expect(gate.snapshot()).toEqual({ limit: 1, active: 0, queued: 0 })
  })

  it("makes detached work queue for its own slot once the outer slot is released", async () => {
    const gate = new ConcurrencyGate(1)
    let releaseDetached!: () => void
    const detachedStarted = new Promise<void>((resolve) => {
      releaseDetached = resolve
    })
    let detached: Promise<string> | undefined

    await gate.run(async () => {
      detached = (async () => {
        await detachedStarted
        return gate.run(async () => "detached")
      })()
    })

    // Hold the only slot so the detached call must queue.
    let releaseBlocker!: () => void
    const blocker = gate.run(
      () => new Promise<void>((resolve) => {
        releaseBlocker = resolve
      }),
    )
    releaseDetached()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(gate.snapshot()).toEqual({ limit: 1, active: 1, queued: 1 })

    releaseBlocker()
    await blocker
    await expect(detached).resolves.toBe("detached")
    expect(gate.snapshot()).toEqual({ limit: 1, active: 0, queued: 0 })
  })

  it("rejects a waiter that exceeds its wait deadline and removes it from the queue", async () => {
    const gate = new ConcurrencyGate(1)
    let releaseBlocker!: () => void
    const blocker = gate.run(
      () => new Promise<void>((resolve) => {
        releaseBlocker = resolve
      }),
    )

    const timedOut = gate.run(async () => "never", { waitTimeoutMs: 5 })
    await expect(timedOut).rejects.toBeInstanceOf(TimeoutError)
    expect(gate.snapshot()).toEqual({ limit: 1, active: 1, queued: 0 })

    const next = gate.run(async () => "next")
    releaseBlocker()
    await blocker
    await expect(next).resolves.toBe("next")
    expect(gate.snapshot()).toEqual({ limit: 1, active: 0, queued: 0 })
  })

  it("serves queued waiters in order and never exceeds the limit around a release", async () => {
    const gate = new ConcurrencyGate(1)
    const order: string[] = []
    let active = 0
    let maximum = 0
    const track = async (name: string) => {
      active += 1
      maximum = Math.max(maximum, active)
      order.push(name)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
    }
    let releaseFirst!: () => void

    const first = gate.run(
      () => new Promise<void>((resolve) => {
        releaseFirst = resolve
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    const queued = gate.run(() => track("queued"))
    releaseFirst()
    // Arrives right as the slot is being released.
    const latecomer = first.then(() => gate.run(() => track("latecomer")))

    await Promise.all([first, queued, latecomer])
    expect(order).toEqual(["queued", "latecomer"])
    expect(maximum).toBe(1)
    expect(gate.snapshot()).toEqual({ limit: 1, active: 0, queued: 0 })
  })
})
