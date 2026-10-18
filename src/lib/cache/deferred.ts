import { AsyncLocalStorage } from "node:async_hooks"
import { revalidateTag } from "next/cache"

/**
 * Deferred cache invalidation for DB write paths.
 *
 * `revalidateTag` called *inside* a transaction fires before commit: a
 * concurrent request can repopulate the cache from pre-commit data, which
 * then goes stale when the transaction commits (and an invalidated tag on a
 * rolled-back transaction causes a pointless rebuild). Write paths therefore
 * queue invalidations and flush them only after the write succeeds.
 *
 * Usage inside a `withDbWrite` body: `queueTagRevalidate(tag, profile)`.
 * Outside a deferred scope it invalidates immediately, preserving the old
 * direct-call behavior. The flush swallows errors when invoked outside a
 * Next.js cache context (e.g. unit tests).
 */

interface DeferredInvalidation {
  tag: string
  profile: Parameters<typeof revalidateTag>[1]
}

const storage = new AsyncLocalStorage<{ queue: DeferredInvalidation[] }>()

export function queueTagRevalidate(tag: string, profile: Parameters<typeof revalidateTag>[1]): void {
  const store = storage.getStore()
  if (!store) {
    flushEntry({ tag, profile })
    return
  }
  store.queue.push({ tag, profile })
}

function flushEntry(entry: DeferredInvalidation): void {
  try {
    revalidateTag(entry.tag, entry.profile)
  } catch {
    // revalidateTag is a Next.js server-only API; ignore if invoked outside
    // cache context (tests).
  }
}

export async function runWithDeferredCacheInvalidation<T>(fn: () => Promise<T>): Promise<T> {
  const store = { queue: [] as DeferredInvalidation[] }
  const result = await storage.run(store, fn)
  // Flushed only on success — a rolled-back transaction must not invalidate.
  for (const entry of store.queue) flushEntry(entry)
  return result
}
