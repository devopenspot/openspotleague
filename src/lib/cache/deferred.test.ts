import { describe, expect, it, vi, beforeEach } from "vitest"

const revalidateTagMock = vi.fn()

vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))

import { queueAfterCommit, queueTagRevalidate, runWithDeferredCacheInvalidation } from "./deferred"

const PROFILE = { revalidate: 60, stale: 300, expire: 3600 } as const

beforeEach(() => {
  revalidateTagMock.mockReset()
})

describe("deferred cache invalidation", () => {
  it("invalidates immediately outside a deferred scope", () => {
    queueTagRevalidate("profile:user:1", PROFILE)
    expect(revalidateTagMock).toHaveBeenCalledWith("profile:user:1", PROFILE)
  })

  it("defers queued invalidations until the scope completes", async () => {
    const result = await runWithDeferredCacheInvalidation(async () => {
      queueTagRevalidate("a", PROFILE)
      queueTagRevalidate("b", PROFILE)
      expect(revalidateTagMock).not.toHaveBeenCalled()
      return "ok"
    })
    expect(result).toBe("ok")
    expect(revalidateTagMock.mock.calls.map((c) => c[0])).toEqual(["a", "b"])
  })

  it("does not flush when the wrapped write throws (rollback)", async () => {
    await expect(
      runWithDeferredCacheInvalidation(async () => {
        queueTagRevalidate("a", PROFILE)
        throw new Error("transaction rolled back")
      }),
    ).rejects.toThrow("transaction rolled back")
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it("swallows revalidateTag errors (outside cache context)", async () => {
    revalidateTagMock.mockImplementation(() => {
      throw new Error("no cache context")
    })
    expect(() => queueTagRevalidate("a", PROFILE)).not.toThrow()
    await expect(runWithDeferredCacheInvalidation(async () => {
      queueTagRevalidate("b", PROFILE)
    })).resolves.toBeUndefined()
  })

  it("runs after-commit tasks only once the write succeeds", async () => {
    const task = vi.fn(async () => undefined)
    await runWithDeferredCacheInvalidation(async () => {
      queueAfterCommit("test", task)
      expect(task).not.toHaveBeenCalled()
    })
    expect(task).toHaveBeenCalledTimes(1)
  })

  it("drops after-commit tasks when the write throws", async () => {
    const task = vi.fn(async () => undefined)
    await expect(
      runWithDeferredCacheInvalidation(async () => {
        queueAfterCommit("test", task)
        throw new Error("rolled back")
      }),
    ).rejects.toThrow("rolled back")
    expect(task).not.toHaveBeenCalled()
  })

  it("logs instead of throwing when an after-commit task fails", async () => {
    await expect(
      runWithDeferredCacheInvalidation(async () => {
        queueAfterCommit("test", async () => {
          throw new Error("queue down")
        })
        return "ok"
      }),
    ).resolves.toBe("ok")
  })
})
