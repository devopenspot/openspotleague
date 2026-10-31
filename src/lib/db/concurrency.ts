// These gates are deliberately process-local, and request-local on Workers,
// where a waiter cannot be resumed by another request. They cannot coordinate
// across instances, but a gate still prevents one request or warm instance
// from multiplying a small Supabase pool with an unbounded Promise.all fan-out.

import { isRequestScoped, perRequest } from "@/lib/utils/request-scope"

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

export class ConcurrencyGate {
  private active = 0
  private readonly queue: Waiter[] = []

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

  drain(): void {
    while (this.queue.length > 0) {
      const w = this.queue.shift()
      w?.resolve()
    }
  }

  async run<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push({ resolve }))
    }

    this.active += 1
    try {
      return await fn()
    } finally {
      this.active -= 1
      const next = this.queue.shift()
      next?.resolve()
    }
  }
}

interface GlobalConcurrencyState {
  gate?: ConcurrencyGate
}

const globalForConcurrency = globalThis as typeof globalThis & {
  __openspotDbConcurrency?: GlobalConcurrencyState
}

const requestConcurrencyState = perRequest<GlobalConcurrencyState>(() => ({}))

function getConcurrencyState(): GlobalConcurrencyState {
  if (isRequestScoped()) return requestConcurrencyState()
  globalForConcurrency.__openspotDbConcurrency ??= {}
  return globalForConcurrency.__openspotDbConcurrency
}

function getGlobalGate(limit: number): ConcurrencyGate {
  const state = getConcurrencyState()
  const existing = state.gate
  if (existing && existing.snapshot().limit === limit) return existing
  if (existing) existing.drain()

  const gate = new ConcurrencyGate(limit)
  state.gate = gate
  return gate
}

export function withGlobalDbConcurrency<T>(
  limit: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  return getGlobalGate(limit).run(fn)
}

export function getGlobalDbConcurrencySnapshot(limit: number): ConcurrencySnapshot {
  return getGlobalGate(limit).snapshot()
}
