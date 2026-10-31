/**
 * Raised when a DB operation (including the wait for a concurrency-gate
 * slot) exceeds its client-side deadline. Lives outside `client.ts` so the
 * gate in `concurrency.ts` can throw it without a circular import;
 * `client.ts` re-exports it for existing `instanceof TimeoutError` checks.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`db operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}
