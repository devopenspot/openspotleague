"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { loadGuestToken } from "@/lib/games/guest";
import { gameMutationResponseSchema, type GameState } from "@/lib/schemas/game";
import { showToast } from "@/hooks/ui/useToast";

type ActionOptions = {
  silentStale?: boolean;
  isSuperseded?: (game: GameState | null) => boolean;
};

function debugGameAction(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[games] ${event}`, details);
  }
}

function guestHeaders(includeName = false): Record<string, string> {
  const token = loadGuestToken();
  if (!token) return {};
  const headers: Record<string, string> = { "x-guest-token": token };
  if (typeof sessionStorage !== "undefined") {
    const name = sessionStorage.getItem("openspot-guest-name");
    if (name && includeName) headers["x-guest-name"] = name;
  }
  return headers;
}

export type GameMutationSuccess = ReturnType<typeof gameMutationResponseSchema.parse>;
export type GameErrorPayload = { code?: string; error?: string; status?: string; reason?: string | null };
export type GameActionResult =
  | { ok: true; data: GameMutationSuccess }
  | { ok: false; data: GameErrorPayload | null };
export type GameAction = (
  path: string,
  payload?: Record<string, unknown>,
  options?: { silentStale?: boolean; isSuperseded?: (game: GameState | null) => boolean },
) => Promise<GameActionResult | null>;

async function fetchWithTransportRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    // A transport failure can follow a committed write. Retry the exact request so the server's idempotency record can safely reconcile it.
    return await fetch(url, init);
  }
}

function resolveHeaders(authenticated: boolean, path: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(authenticated ? {} : guestHeaders(path === "/join")),
  };
}

export function useGameAction({
  gameId,
  latestGameRef,
  refreshGameState,
  setError,
  authenticated = true,
}: {
  gameId: string;
  latestGameRef: MutableRefObject<GameState | null>;
  refreshGameState: () => Promise<GameState>;
  setError: (message: string | null) => void;
  authenticated?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  const actionInFlightRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const action = useCallback(
    async (
      path: string,
      payload: Record<string, unknown> = {},
      options: ActionOptions = {},
    ) => {
      const currentGame = latestGameRef.current;
      const inflightKey = `${path}:${currentGame?.version ?? "none"}`;
      if (!currentGame || actionInFlightRef.current.has(inflightKey)) return null;
      actionInFlightRef.current.add(inflightKey);
      const expectedVersion = currentGame.version;
      const idempotencyKey = crypto.randomUUID();
      const requestBody = JSON.stringify({
        expectedVersion,
        idempotencyKey,
        ...payload,
      });
      debugGameAction("action.request", { gameId, path, expectedVersion });
      setBusy(true);
      setError(null);
      try {
        const url = `/api/games/${gameId}${path}`;
        const headers = resolveHeaders(authenticated, path);
        let response = await fetchWithTransportRetry(url, { method: "POST", headers, body: requestBody });
        let rawData: unknown = await response.json().catch(() => null);
        let data: GameMutationSuccess | GameErrorPayload = response.ok
          ? gameMutationResponseSchema.parse(rawData)
          : (rawData as GameErrorPayload) ?? {};
        debugGameAction("action.response", {
          gameId,
          path,
          ok: response.ok,
          status: response.status,
          code: (data as GameErrorPayload)?.code ?? null,
          message: (data as GameErrorPayload)?.error ?? null,
          expectedVersion,
        });
        // Auto-retry once on STALE_VERSION for solo exhaust without reload
        if (!response.ok && (rawData as GameErrorPayload)?.code === "STALE_VERSION") {
          try {
            const fresh = await refreshGameState();
            const retryVersion = fresh.version;
            const retryKey = crypto.randomUUID();
            const retryBody = JSON.stringify({ expectedVersion: retryVersion, idempotencyKey: retryKey, ...payload });
            debugGameAction("action.retry", { gameId, path, retryVersion });
            const retryRes = await fetchWithTransportRetry(url, {
              method: "POST",
              headers,
              body: retryBody,
            });
            const retryRaw = await retryRes.json().catch(() => null);
            const retryData: GameMutationSuccess | GameErrorPayload = retryRes.ok
              ? gameMutationResponseSchema.parse(retryRaw)
              : (retryRaw as GameErrorPayload) ?? {};
            debugGameAction("action.retry.response", { gameId, path, ok: retryRes.ok, code: (retryData as GameErrorPayload)?.code ?? null });
            response = retryRes;
            rawData = retryRaw;
            data = retryData;
          } catch {
            // retry failed — keep original stale response for error handling
          }
        }
        let refreshed: GameState | null = null;
        try {
          refreshed = await refreshGameState();
          debugGameAction("action.refresh", {
            gameId,
            path,
            status: refreshed.status,
            version: refreshed.version,
          });
        } catch {
          if (mountedRef.current && response.ok) {
            setError("Action submitted. Waiting for the updated game state.");
          }
        }
        const superseded = options.isSuperseded?.(refreshed) ?? false;
        const errorPayload = data as GameErrorPayload;
        const startWasAlreadyApplied =
          ["/start", "/train-alone"].includes(path) &&
          !response.ok &&
          errorPayload?.code === "INVALID_TRANSITION" &&
          refreshed?.status === "active";
        if (
          !response.ok &&
          !startWasAlreadyApplied &&
          !superseded &&
          !(options.silentStale && errorPayload?.code === "STALE_VERSION")
        ) {
          if (mountedRef.current) {
            setError(errorPayload?.error ?? "Action was rejected. Refreshing state.");
          }
        }
        if (response.ok) {
          const labels: Record<string, string> = {
            "/join": "You joined the challenge.",
            "/start": "Challenge started.",
            "/train-alone": "Solo training started.",
            "/leave": "You left the lobby.",
          };
          if (path.includes("/next-trick")) showToast("Alternative trick ready.", "success");
          else if (labels[path]) showToast(labels[path], "success");
        } else if (
          !superseded &&
          (!options.silentStale || errorPayload?.code !== "STALE_VERSION")
        ) {
          showToast(errorPayload?.error ?? "Action was rejected.", "error");
        }
        if (startWasAlreadyApplied) {
          debugGameAction("start.reconciled", { gameId, expectedVersion, status: refreshed?.status, version: refreshed?.version });
        }
        if (response.ok) {
          return { ok: true as const, data: data as GameMutationSuccess };
        }
        return { ok: false as const, data: data as GameErrorPayload | null };
      } catch {
        if (mountedRef.current) {
          try {
            await refreshGameState();
            setError("The action result was uncertain. The game state was refreshed.");
          } catch {
            setError("The action could not be completed. Refresh the game and try again.");
          }
        }
        return { ok: false as const, data: null };
      } finally {
        actionInFlightRef.current.delete(inflightKey);
        if (mountedRef.current) setBusy(false);
      }
    },
    [authenticated, gameId, latestGameRef, refreshGameState, setError],
  );

  return { action, busy };
}
