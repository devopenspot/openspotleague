"use client";

/**
 * Shared contest state for the hub tabs (and the embedded organizer
 * console): one fetch of `/api/league/events/[id]`, refreshed by the
 * league realtime signal channel, plus a mutation helper that sends the
 * current `expectedVersion` and a fresh idempotency key.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLeagueRealtime } from "@/components/league/hooks/useLeagueRealtime";
import type { LeagueEventState } from "@/lib/services/league";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";

export interface ContestStateApi {
  state: LeagueEventState | null;
  error: string | null;
  busy: boolean;
  actionError: string | null;
  connection: "connected" | "reconnecting";
  load: () => Promise<void>;
  retry: () => void;
  clearActionError: () => void;
  /** POST/PATCH/DELETE `/api/league/events/[id]{path}` with OCC + idempotency. */
  mutate: (
    path: string,
    method?: "POST" | "PATCH" | "DELETE",
    body?: Record<string, unknown>,
  ) => Promise<boolean>;
  /** Run any versioned request (cover upload…) through the same busy/error flow. */
  run: (action: (version: number) => Promise<Response>) => Promise<boolean>;
}

export function useContestState(eventId: string, options: { enabled?: boolean } = {}): ContestStateApi {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<LeagueEventState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const stateRef = useRef<LeagueEventState | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(`/api/league/events/${eventId}`, {
        cache: "no-store",
        timeoutMs: DEFAULT_READ_TIMEOUT_MS,
      });
      if (!response.ok) {
        if (!stateRef.current) setError("This contest could not be loaded. Try again shortly.");
        return;
      }
      const data = (await response.json()) as LeagueEventState;
      stateRef.current = data;
      setError(null);
      setState(data);
    } catch {
      if (!stateRef.current) setError("This contest could not be loaded. Try again shortly.");
    }
  }, [eventId]);

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      await load();
    })();
  }, [enabled, load, reloadTick]);

  const connection = useLeagueRealtime(enabled ? eventId : null, load);

  const run = useCallback(
    async (action: (version: number) => Promise<Response>): Promise<boolean> => {
      const current = stateRef.current;
      if (!current) return false;
      setBusy(true);
      setActionError(null);
      try {
        const response = await action(current.event.version);
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(raw?.message ?? raw?.error ?? "Action failed.");
          return false;
        }
        await load();
        return true;
      } catch {
        setActionError("Action failed. Check your connection and try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const mutate = useCallback(
    (path: string, method: "POST" | "PATCH" | "DELETE" = "POST", body?: Record<string, unknown>) =>
      run((version) =>
        fetchWithTimeout(`/api/league/events/${eventId}${path}`, {
          method,
          timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
            ...(body ?? {}),
          }),
        }),
      ),
    [eventId, run],
  );

  const retry = useCallback(() => {
    setError(null);
    setReloadTick((tick) => tick + 1);
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  return { state, error, busy, actionError, connection, load, retry, clearActionError, mutate, run };
}
