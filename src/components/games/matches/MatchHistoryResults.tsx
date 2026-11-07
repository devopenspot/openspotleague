"use client";

import type { ReactNode } from "react";
import { AwardDialog } from "@/components/games/award/AwardDialog";
import { useAwardHistory } from "@/components/games/award/useAwardHistory";
import type { GameListItem } from "@/lib/schemas/game";
import type { RowResultsState } from "./MatchHistoryRow";

const IDLE: RowResultsState = { kind: "idle" };

export type MatchHistoryResultsApi = {
  open: (game: Pick<GameListItem, "id" | "shareCode">) => void;
  stateFor: (gameId: string) => RowResultsState;
};

/**
 * Loads a finished game's results on demand and shows them in the shared
 * AwardDialog. Owns the request so the list and rows stay presentational.
 */
export function MatchHistoryResults({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: (api: MatchHistoryResultsApi) => ReactNode;
}) {
  const { state, openForGame, close } = useAwardHistory({ authenticated });

  const api: MatchHistoryResultsApi = {
    open: (game) => void openForGame(game.id, { shareCode: game.shareCode }),
    stateFor: (gameId) => {
      if (state.gameId !== gameId) return IDLE;
      if (state.loading) return { kind: "loading" };
      if (state.error) return { kind: "error", message: state.error };
      return IDLE;
    },
  };

  return (
    <>
      {children(api)}
      {state.game ? (
        <AwardDialog isOpen={state.open} onClose={close} game={state.game} context="list" />
      ) : null}
    </>
  );
}
