// These gates are deliberately process-local. A Vercel instance cannot
// coordinate with another instance, but a gate still prevents one warm
// instance from multiplying a small Supabase pool with an unbounded
// Promise.all fan-out.

import { AsyncLocalStorage } from "node:async_hooks"
import { TimeoutError } from "./errors"

type AsyncFn = () => unknown

type AwaitedResults<T> = {
  [K in keyof T]: T[K] extends AsyncFn
    ? Awaited<ReturnType<T[K]>>
    : T[K]
}

/**
 * Request-bound fan-out helper — owns queue, workers respect limit=POOL_MAX.
 * Single-thread safe via queue.shift() atomic; do NOT share across requests.
 * For global checkout throttling, use withGlobalDbConcurrency(CONCURRENCY_MAX) in lib/db/client.ts (single owner).
 */
export async function withDbConcurrency<const T extends ReadonlyArray<AsyncFn>>(
  limit: number,
  fns: T,
): Promise<AwaitedResults<T>> {
  if (limit < 1) {
    throw new Error(`withDbConcurrency: limit must be >= 1, got ${limit}`)
  }
  const total = fns.length
  if (total === 0) return [] as unknown as AwaitedResults<T>

  const results: unknown[] = new Array(total)
  const queue = fns.map((fn, idx) => ({ fn, idx }))

  async function worker(): Promise<void> {
    while (true) {
      const item = queue.shift()
      if (!item) return
      results[item.idx] = await item.fn()
    }
  }

  const workerCount = Math.min(limit, total)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results as AwaitedResults<T>
}

export interface ConcurrencySnapshot {
  limit: number
  active: number
  queued: number
}

interface Waiter {
  resolve: () => void
}

export interface GateRunOptions {
  /** Reject with `TimeoutError` if no slot frees up within this many ms. */
  waitTimeoutMs?: number
}

interface SlotStore {
  held: boolean
}

export class ConcurrencyGate {
  private active = 0
  private readonly queue: Waiter[] = []
  // Marks async contexts that already hold a slot on this gate, so nested
  // operations (a repository call inside a `withDbWrite` body) run inside the
  // outer slot instead of waiting on themselves. Connections stay bounded by
  // the postgres.js pool `max`.
  private readonly slot = new AsyncLocalStorage<SlotStore>()

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`ConcurrencyGate: limit must be a positive integer, got ${limit}`)
    }
  }

  snapshot(): ConcurrencySnapshot {
    return {
      limit: this.limit,
      active: this.active,
      queued: this.queue.length,
    }
  }

  /** Releases every waiter past the limit; only used when the gate is replaced. */
  drain(): void {
    while (this.queue.length > 0) {
      const w = this.queue.shift()
      this.active += 1
      w?.resolve()
    }
  }

  async run<T>(fn: () => Promise<T> | T, options: GateRunOptions = {}): Promise<T> {
    if (this.slot.getStore()?.held) return fn()

    await this.acquire(options.waitTimeoutMs)
    const store: SlotStore = { held: true }
    try {
      return await this.slot.run(store, fn)
    } finally {
      // Detached promises started inside `fn` keep this store; clearing the
      // flag makes them queue for their own slot once this one is released.
      store.held = false
      this.release()
    }
  }

  private acquire(waitTimeoutMs: number | undefined): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const waiter: Waiter = {
        resolve: () => {
          if (timer) clearTimeout(timer)
          resolve()
        },
      }
      if (waitTimeoutMs !== undefined) {
        timer = setTimeout(() => {
          const index = this.queue.indexOf(waiter)
          if (index !== -1) this.queue.splice(index, 1)
          reject(new TimeoutError(waitTimeoutMs))
        }, Math.max(0, waitTimeoutMs))
      }
      this.queue.push(waiter)
    })
  }

  private release(): void {
    const next = this.queue.shift()
    // Hand the slot straight to the next waiter so a new caller cannot take
    // it in the gap before the waiter resumes.
    if (next) next.resolve()
    else this.active -= 1
  }
}

interface GlobalConcurrencyState {
  gate: ConcurrencyGate
}

const globalForConcurrency = globalThis as typeof globalThis & {
  __openspotDbConcurrency?: GlobalConcurrencyState
}

function getGlobalGate(limit: number): ConcurrencyGate {
  const existing = globalForConcurrency.__openspotDbConcurrency?.gate
  if (existing && existing.snapshot().limit === limit) return existing
  if (existing) existing.drain()

  const gate = new ConcurrencyGate(limit)
  globalForConcurrency.__openspotDbConcurrency = { gate }
  return gate
}

export function withGlobalDbConcurrency<T>(
  limit: number,
  fn: () => Promise<T> | T,
  options?: GateRunOptions,
): Promise<T> {
  return getGlobalGate(limit).run(fn, options)
}

export function getGlobalDbConcurrencySnapshot(limit: number): ConcurrencySnapshot {
  return getGlobalGate(limit).snapshot()
}
