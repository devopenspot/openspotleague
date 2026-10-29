import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBoundedFetch,
  fetchWithTimeout,
} from "./fetch-timeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("resolves normally when fetch completes within timeoutMs", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWithTimeout("/api/test", {
      headers: { "x-test": "1" },
      timeoutMs: 5_000,
    });

    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ "x-test": "1" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts and rejects with TimeoutError when a suspended fetch hangs past timeoutMs", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );

    const callerController = new AbortController();
    const promise = fetchWithTimeout("/api/hung", {
      signal: callerController.signal,
      timeoutMs: 1_000,
    });
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(capturedSignal?.aborted).toBe(true);
    // Caller's own AbortController must remain untouched so callers distinguish timeout vs unmount.
    expect(callerController.signal.aborted).toBe(false);
  });

  it("propagates caller AbortSignal cancellation with AbortError", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );

    const callerController = new AbortController();
    const promise = fetchWithTimeout("/api/cancel", {
      signal: callerController.signal,
      timeoutMs: 10_000,
    });

    callerController.abort();

    await expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("creates a bounded fetch wrapper for SDK clients", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    const boundedFetch = createBoundedFetch(500);
    const promise = boundedFetch("/api/auth");
    const assertion = expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});
