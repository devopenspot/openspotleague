"use client";

import { useMyGames, type MyGamesState } from "@/components/games/hooks/useMyGames";
import { BODY, controlClass } from "@/components/ui/recipes";
import { MatchHistoryResults } from "./MatchHistoryResults";
import { MatchHistoryRow } from "./MatchHistoryRow";

/** The rider's games, newest first. Rendered inside the "Your games" drawer. */
export function MatchList({
  authenticated,
  limit = 20,
  list,
}: {
  /** Signed-in riders are identified by session, never by a stored guest token. */
  authenticated: boolean;
  limit?: number;
  /** Games a parent already loaded, to avoid a second request. */
  list?: MyGamesState;
}) {
  const ownList = useMyGames({ limit, enabled: list === undefined });
  const { games, status, reload } = list ?? ownList;

  if (status === "loading") {
    return (
      <p role="status" className={`py-8 ${BODY}`}>
        Loading your games…
      </p>
    );
  }
  if (status === "error") {
    return (
      <div role="alert" className="space-y-3 py-8 text-sm text-on-surface">
        <p>Your games couldn&apos;t load. Check your signal and try again.</p>
        {reload ? (
          <button type="button" onClick={reload} className={controlClass("outline")}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  if (games.length === 0) {
    return (
      <p className={`py-8 ${BODY}`}>
        No games yet. Start a training or a battle to fill your history.
      </p>
    );
  }

  return (
    <MatchHistoryResults authenticated={authenticated}>
      {(results) => (
        <ul className="divide-y divide-outline-variant">
          {games.map((game) => (
            <MatchHistoryRow
              key={game.id}
              game={game}
              results={results.stateFor(game.id)}
              onViewResults={() => results.open(game)}
            />
          ))}
        </ul>
      )}
    </MatchHistoryResults>
  );
}
