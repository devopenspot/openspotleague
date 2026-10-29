export const DEFAULT_READ_TIMEOUT_MS = 12_000;
export const DEFAULT_MUTATION_TIMEOUT_MS = 15_000;

export interface FetchWithTimeoutInit extends RequestInit {
  /** Maximum time in milliseconds before the request is aborted. Defaults to 12,000ms. */
  timeoutMs?: number;
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export function createTimeoutError(timeoutMs: number): DOMException {
  return new DOMException(
    `The operation timed out after ${timeoutMs}ms.`,
    "TimeoutError",
  );
}

/**
 * Executes `fetch` with a hard timeout and full upstream `AbortSignal` propagation.
 *
 * - Aborts the underlying browser `fetch` via an internal `AbortController`.
 * - Also races the `fetch` promise against the timeout/abort signal so sockets
 *   suspended by OS app-switching reject deterministically when the timer fires
 *   without mutating the caller's own `AbortSignal`.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: FetchWithTimeoutInit,
): Promise<Response> {
  const { timeoutMs = DEFAULT_READ_TIMEOUT_MS, signal: upstreamSignal, ...restInit } =
    init ?? {};

  if (upstreamSignal?.aborted) {
    throw createAbortError();
  }

  if (timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    return fetch(input, upstreamSignal ? { ...restInit, signal: upstreamSignal } : restInit);
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let onUpstreamAbort: (() => void) | null = null;

  const outcomePromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = createTimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);

    if (upstreamSignal) {
      onUpstreamAbort = () => {
        const error = createAbortError();
        controller.abort(error);
        reject(error);
      };
      upstreamSignal.addEventListener("abort", onUpstreamAbort, { once: true });
    }
  });

  try {
    const fetchPromise = fetch(input, {
      ...restInit,
      signal: controller.signal,
    });
    return await Promise.race([fetchPromise, outcomePromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (upstreamSignal && onUpstreamAbort) {
      upstreamSignal.removeEventListener("abort", onUpstreamAbort);
    }
  }
}

/**
 * Returns a `fetch`-compatible function bound to a default timeout, suitable
 * for passing into SDK clients such as `@supabase/ssr`'s `global.fetch`.
 */
export function createBoundedFetch(
  defaultTimeoutMs = DEFAULT_READ_TIMEOUT_MS,
): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) =>
    fetchWithTimeout(input, { ...init, timeoutMs: defaultTimeoutMs });
}
