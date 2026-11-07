"use client";

import { useCallback, useRef, useState } from "react";
import { loadGuestToken } from "@/lib/games/guest";
import { gameStateSchema, type GameState } from "@/lib/schemas/game";

type AwardHistoryState = {
  open: boolean;
  gameId: string | null;
  game: GameState | null;
  loading: boolean;
  error: string | null;
};

function guestHeaders(): Record<string, string> {
  const token = loadGuestToken();
  if (!token) return {};
  return { "x-guest-token": token };
}

const RESULTS_FAILED = "Results couldn't load. Check your signal and try again.";

/** A results failure whose message is written for riders. */
class ResultsError extends Error {}

export function useAwardHistory() {
  const [state, setState] = useState<AwardHistoryState>({
    open: false,
    gameId: null,
    game: null,
    loading: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const openForGame = useCallback(async (gameId: string, opts?: { shareCode?: string }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({ ...s, open: false, gameId, loading: true, error: null }));
    try {
      const params = new URLSearchParams();
      if (opts?.shareCode) params.set("share", opts.shareCode);
      const query = params.size > 0 ? `?${params.toString()}` : "";
      const headers: Record<string, string> = { ...guestHeaders() };
      const res = await fetch(`/api/games/${gameId}${query}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ResultsError(
          res.status === 404 ? "That game no longer exists." : RESULTS_FAILED,
        );
      }
      const parsed = gameStateSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new ResultsError(RESULTS_FAILED);
      const game = parsed.data;
      if (controller.signal.aborted) return;
      setState({ open: true, gameId, game, loading: false, error: null });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState((s) => ({
        ...s,
        open: false,
        loading: false,
        error: error instanceof ResultsError ? error.message : RESULTS_FAILED,
      }));
    }
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { state, openForGame, close };
}
