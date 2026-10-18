import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"

interface RequestContext {
  requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function ensureRequestId(value: string | undefined): string {
  const trimmed = value?.trim()
  if (trimmed && trimmed.length <= 128) return trimmed
  return randomUUID()
}

export function runWithRequestContext<T>(
  requestId: string | undefined,
  fn: () => T,
): T {
  return storage.run({ requestId: ensureRequestId(requestId) }, fn)
}

export function getRequestCorrelationId(): string | null {
  return storage.getStore()?.requestId ?? null
}
