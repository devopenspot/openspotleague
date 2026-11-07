"use client";

import { useCallback, useRef, useState } from "react";
import { GUEST_TOKEN_HEADER, loadGuestToken } from "@/lib/games/guest";
import { gameStateSchema, type GameState } from "@/lib/schemas/game";

type AwardHistoryState = {
  open: boolean;
  /** The game the latest request was for: lets a list mark that one row. */
  gameId: string | null;
  game: GameState | null;
  loading: boolean;
  error: string | null;
};

export const AWARD_ERROR_COPY = {
  forbidden: "You can't open these results.",
  missing: "This game is no longer available.",
  generic: "Results couldn't load. Check your signal and try again.",
} as const;

/**
 * Guests identify with the stored token; signed-in riders with their session.
 * The API rejects a request that carries both, and a rider who once played as
 * a guest keeps the token after signing in, so only send it for guests.
 */
function identityHeaders(authenticated: boolean): Record<string, string> {
  if (authenticated) return {};
  const token = loadGuestToken();
  return token ? { [GUEST_TOKEN_HEADER]: token } : {};
}

class AwardRequestError extends Error {}

async function errorCopy(response: Response): Promise<string> {
  if (response.status === 404) return AWARD_ERROR_COPY.missing;
  const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
  if (response.status === 401 || response.status === 403 || body?.code === "NOT_AUTHORIZED") {
    return AWARD_ERROR_COPY.forbidden;
  }
  return AWARD_ERROR_COPY.generic;
}

export function useAwardHistory({ authenticated }: { authenticated: boolean }) {
  const [state, setState] = useState<AwardHistoryState>({
    open: false,
    gameId: null,
    game: null,
    loading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const openForGame = useCallback(
    async (gameId: string, opts?: { shareCode?: string }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((s) => ({ ...s, open: false, gameId, loading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (opts?.shareCode) params.set("share", opts.shareCode);
        const query = params.size > 0 ? `?${params.toString()}` : "";
        const res = await fetch(`/api/games/${gameId}${query}`, {
          headers: identityHeaders(authenticated),
          signal: controller.signal,
        });
        if (!res.ok) throw new AwardRequestError(await errorCopy(res));
        const game = gameStateSchema.parse(await res.json());
        if (controller.signal.aborted) return;
        setState({ open: true, gameId, game, loading: false, error: null });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setState((s) => ({
          ...s,
          open: false,
          loading: false,
          // Never show a raw body or validation dump to the rider.
          error: error instanceof AwardRequestError ? error.message : AWARD_ERROR_COPY.generic,
        }));
      }
    },
    [authenticated],
  );

  const close = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { state, openForGame, close };
}
