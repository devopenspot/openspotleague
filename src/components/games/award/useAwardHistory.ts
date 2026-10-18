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
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `Failed to load game ${gameId}`);
      }
      const json = await res.json();
      const game = gameStateSchema.parse(json);
      if (controller.signal.aborted) return;
      setState({ open: true, gameId, game, loading: false, error: null });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState((s) => ({
        ...s,
        open: false,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load results",
      }));
    }
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { state, openForGame, close };
}
