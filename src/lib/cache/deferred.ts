import { AsyncLocalStorage } from "node:async_hooks"
import { revalidateTag } from "next/cache"
import { runAfterResponse } from "@/lib/utils/request-scope"
import { log } from "@/lib/utils/log"

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

type AfterCommitTask = { label: string; run: () => Promise<void> }

const storage = new AsyncLocalStorage<{
  queue: DeferredInvalidation[]
  afterCommit: AfterCommitTask[]
}>()

/**
 * Side effects that must only happen once the write committed (e.g. handing
 * notification ids to the email queue). Runs after the response on Workers
 * (`ctx.waitUntil`). A failure is logged, never thrown: callers must have a
 * recovery path (the notification tick re-enqueues anything left pending).
 * Outside a deferred scope the task runs immediately.
 */
export function queueAfterCommit(label: string, run: () => Promise<void>): void {
  const store = storage.getStore()
  if (!store) {
    void runAfterCommitTask({ label, run })
    return
  }
  store.afterCommit.push({ label, run })
}

async function runAfterCommitTask(task: AfterCommitTask): Promise<void> {
  await runAfterResponse(async () => {
    try {
      await task.run()
    } catch (error) {
      log.warn("after_commit.failed", {
        label: task.label,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}

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
  const store = { queue: [] as DeferredInvalidation[], afterCommit: [] as AfterCommitTask[] }
  const result = await storage.run(store, fn)
  // Flushed only on success — a rolled-back transaction must not invalidate.
  for (const entry of store.queue) flushEntry(entry)
  for (const task of store.afterCommit) await runAfterCommitTask(task)
  return result
}
