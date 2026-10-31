"use client";

import { useEffect, useState } from "react";
import { loadGuestToken } from "@/lib/games/guest";
import {
  gameListResponseSchema,
  openTrainingGamesResponseSchema,
  type GameListItem,
} from "@/lib/schemas/game";

export type MyGamesState = {
  games: GameListItem[];
  status: "loading" | "ready" | "error";
};

const LOADING_STATE: MyGamesState = { games: [], status: "loading" };

export function useMyGames({
  limit,
  enabled = true,
}: {
  limit: number;
  enabled?: boolean;
}): MyGamesState {
  const [state, setState] = useState<MyGamesState>(LOADING_STATE);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(`/api/games?limit=${limit}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Games could not be loaded");
        setState({
          games: gameListResponseSchema.parse(await response.json()),
          status: "ready",
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ games: [], status: "error" });
        }
      });
    return () => controller.abort();
  }, [enabled, limit]);

  return state;
}

export type ResumableGame = {
  id: string;
  gameName: string;
  status: "lobby" | "active";
};

/** The rider's most recent unfinished game, signed in or as a guest. */
export function useResumableGame({
  signedIn,
  games,
}: {
  signedIn: boolean;
  games: GameListItem[];
}): ResumableGame | null {
  const [guestGame, setGuestGame] = useState<ResumableGame | null>(null);

  useEffect(() => {
    if (signedIn) return;
    const token = loadGuestToken();
    if (!token) return;
    const controller = new AbortController();
    void fetch("/api/games?mode=training&status=open", {
      signal: controller.signal,
      headers: { "x-guest-token": token },
    })
      .then(async (response) => {
        if (!response.ok) return;
        const open = openTrainingGamesResponseSchema.parse(await response.json());
        setGuestGame(open[0] ?? null);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [signedIn]);

  if (!signedIn) return guestGame;
  const game = games.find(
    (candidate) => candidate.status === "lobby" || candidate.status === "active",
  );
  return game
    ? {
        id: game.id,
        gameName: game.gameName,
        status: game.status as ResumableGame["status"],
      }
    : null;
}
