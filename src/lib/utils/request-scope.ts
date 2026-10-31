import { AsyncLocalStorage } from "node:async_hooks"

export const isWorkerRuntime =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers"

/** The Workers static assets binding, narrowed to what the app calls. */
export type AssetFetcher = { fetch(input: URL): Promise<Response> }

type RequestScope = { assets?: AssetFetcher; values: Map<object, unknown> }

const storage = new AsyncLocalStorage<RequestScope>()

/** Opened once per request by `src/worker.ts`. Never entered on Node. */
export function runInRequestScope<T>(assets: AssetFetcher | undefined, fn: () => T): T {
  return storage.run({ assets, values: new Map() }, fn)
}

export function isRequestScoped(): boolean {
  return storage.getStore() !== undefined
}

export function getRequestAssets(): AssetFetcher | undefined {
  return storage.getStore()?.assets
}

/**
 * State that holds sockets or in-flight promises. Workers ties both to the
 * request that created them, so sharing one across requests fails or hangs.
 * Inside a request scope each request gets its own instance. Workers code
 * outside a scope (cache regeneration) gets a fresh one, and Node shares one.
 */
export function perRequest<T>(create: () => T): () => T {
  const key = {}
  let shared: { value: T } | undefined
  return () => {
    const scope = storage.getStore()
    if (!scope) {
      if (isWorkerRuntime) return create()
      shared ??= { value: create() }
      return shared.value
    }
    if (!scope.values.has(key)) scope.values.set(key, create())
    return scope.values.get(key) as T
  }
}
