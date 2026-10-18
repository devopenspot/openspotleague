import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePendingActions } from "./usePendingActions"

const showToastMock = vi.fn()
vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}))

describe("usePendingActions", () => {
  beforeEach(() => {
    showToastMock.mockReset()
  })

  it("starts with empty pending set", () => {
    const { result } = renderHook(() => usePendingActions())
    expect(result.current.pending.size).toBe(0)
    expect(result.current.isPending("any")).toBe(false)
  })

  it("tracks pending state through run lifecycle", async () => {
    const { result } = renderHook(() => usePendingActions())
    let resolve!: () => void
    const task = new Promise<void>((r) => {
      resolve = r
    })

    let runPromise: Promise<void>
    act(() => {
      runPromise = result.current.run("key:1", () => task)
    })

    expect(result.current.pending.has("key:1")).toBe(true)
    expect(result.current.isPending("key:1")).toBe(true)

    await act(async () => {
      resolve()
      await runPromise
    })

    expect(result.current.pending.has("key:1")).toBe(false)
  })

  it("prevents concurrent run for same key and shows toast", async () => {
    const { result } = renderHook(() => usePendingActions())
    let resolve!: () => void
    const task = new Promise<void>((r) => {
      resolve = r
    })

    const firstFn = vi.fn(() => task)
    const secondFn = vi.fn(async () => {})

    act(() => {
      void result.current.run("dup", firstFn)
    })
    expect(firstFn).toHaveBeenCalledTimes(1)

    act(() => {
      void result.current.run("dup", secondFn)
    })

    expect(secondFn).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith("Please wait for this change to finish", "error")

    await act(async () => {
      resolve()
      // allow pending cleanup
      await new Promise((r) => setTimeout(r, 0))
    })

    // after completion, same key can run again
    const thirdFn = vi.fn(async () => {})
    await act(async () => {
      await result.current.run("dup", thirdFn)
    })
    expect(thirdFn).toHaveBeenCalledTimes(1)
  })

  it("allows concurrent runs for different keys", async () => {
    const { result } = renderHook(() => usePendingActions())
    const fnA = vi.fn(async () => new Promise<void>((r) => setTimeout(r, 10)))
    const fnB = vi.fn(async () => {})

    await act(async () => {
      await Promise.all([result.current.run("a", fnA), result.current.run("b", fnB)])
    })

    expect(fnA).toHaveBeenCalledTimes(1)
    expect(fnB).toHaveBeenCalledTimes(1)
    expect(result.current.pending.size).toBe(0)
  })
})
