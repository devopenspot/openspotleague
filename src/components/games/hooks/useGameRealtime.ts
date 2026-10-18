"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptAuthoritativeState,
  subscribeToGame,
} from "@/lib/games/realtime";
import { loadGuestToken } from "@/lib/games/guest";
import { gameStateSchema, type GameState } from "@/lib/schemas/game";

function guestHeaders(): Record<string, string> {
  const token = loadGuestToken();
  if (!token) return {};
  const headers: Record<string, string> = { "x-guest-token": token };
  return headers;
}

export async function fetchGameState(
  id: string,
  shareCode?: string,
  version?: number,
  options: { authenticated?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (shareCode) params.set("share", shareCode);
  if (version !== undefined) params.set("version", String(version));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`/api/games/${id}${query}`, {
    cache: "no-store",
    headers: options.authenticated === false ? guestHeaders() : {},
  });
  if (response.status === 304) return null;
  if (!response.ok) throw new Error("Game state could not be loaded");
  return gameStateSchema.parse(await response.json());
}

export function useGameRealtime(id: string, shareCode?: string, options: { authenticated?: boolean } = {}) {
  const [game, setGame] = useState<GameState | null>(null);
  const [connection, setConnection] = useState<"connected" | "reconnecting">(
    "connected",
  );
  const [error, setError] = useState<string | null>(null);
  const latestGameRef = useRef<GameState | null>(null);
  const controllerRef = useRef<ReturnType<typeof subscribeToGame> | null>(null);
  const guestRef = useRef(options.authenticated === false);
  const guestMode = options.authenticated === false;

  useEffect(() => {
    guestRef.current = guestMode;
  }, [guestMode]);

  useEffect(() => {
    latestGameRef.current = game;
  }, [game]);

  const applyGameState = useCallback((incoming: GameState) => {
    const accepted = acceptAuthoritativeState(latestGameRef.current, incoming);
    if (!accepted) return;
    latestGameRef.current = accepted;
    setGame(accepted);
    setError(null);
  }, []);

  const refreshGameState = useCallback(async () => {
    if (controllerRef.current) {
      try {
        await controllerRef.current.refresh();
        if (latestGameRef.current) return latestGameRef.current;
      } catch {
        // Fall through to a direct request so mutations still get one retry.
      }
    }
    const fresh = await fetchGameState(id, shareCode, latestGameRef.current?.version, {
      authenticated: !guestRef.current,
    });
    if (fresh) applyGameState(fresh);
    if (latestGameRef.current) return latestGameRef.current;
    throw new Error("Game state could not be loaded");
  }, [applyGameState, id, shareCode]);

  useEffect(() => {
    let cancelled = false;

    void fetchGameState(id, shareCode, undefined, { authenticated: !guestRef.current })
      .then((initial) => {
        if (cancelled) return;
        if (!initial) throw new Error("Game state could not be loaded");
        applyGameState(initial);
        try {
          controllerRef.current = subscribeToGame({
            gameId: id,
            initialState: initial,
            fetchState: async () =>
              (await fetchGameState(id, shareCode, latestGameRef.current?.version, { authenticated: !guestRef.current })) ??
              initial,
            onState: (state) => {
              if (!cancelled) applyGameState(state);
            },
            onConnectionChange: (status) => {
              if (!cancelled) setConnection(status);
            },
            useChannel: !guestRef.current,
          });
        } catch {
          if (!cancelled) setConnection("reconnecting");
        }
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Game state could not be loaded",
        );
      });

    return () => {
      cancelled = true;
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, [applyGameState, guestMode, id, shareCode]);

  return {
    game,
    connection,
    error,
    setError,
    latestGameRef,
    applyGameState,
    refreshGameState,
  };
}
