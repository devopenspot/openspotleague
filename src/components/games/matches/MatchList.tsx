"use client";

import Link from "next/link";
import {
  DISCIPLINE_META,
  type DisciplineSlug,
} from "@/lib/games/discipline";
import type { GameListItem } from "@/lib/schemas/game";
import { GAME_MODE_LABEL, GAME_STATUS_LABEL } from "@/lib/games/labels";
import { controlClass } from "@/components/ui/recipes";
import { AwardDialog } from "@/components/games/award/AwardDialog";
import { useAwardHistory } from "@/components/games/award/useAwardHistory";
import {
  useMyGames,
  type MyGamesState,
} from "@/components/games/hooks/useMyGames";

export function MatchList({
  limit = 20,
  bare = false,
  list,
}: {
  limit?: number;
  bare?: boolean;
  /** Games a parent already loaded, to avoid a second request. */
  list?: MyGamesState;
}) {
  const ownList = useMyGames({ limit, enabled: list === undefined });
  const { games, status, reload } = list ?? ownList;
  const { state: awardState, openForGame, close: closeAward } = useAwardHistory();
  const content = (
    <>
      {awardState.loading && (
        <p role="status" aria-live="polite" className="py-2 text-sm text-on-surface-variant">
          Loading results…
        </p>
      )}
      {awardState.error && (
        <p role="alert" className="mt-2 rounded-card border border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
          {awardState.error}
        </p>
      )}
      <ListBody games={games} status={status} onRetry={reload} onViewResults={openForGame} />
      {awardState.game && (
        <AwardDialog
          isOpen={awardState.open}
          onClose={closeAward}
          game={awardState.game}
        />
      )}
    </>
  );
  if (bare) return content;
  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-on-surface pb-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Your games
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold uppercase">
            Active & recent
          </h2>
        </div>
        <Link
          href="/games"
          className="inline-flex min-h-control items-center font-display text-xs font-bold uppercase tracking-widest underline underline-offset-4"
        >
          New game ↗
        </Link>
      </div>
      {content}
    </section>
  );
}

function ListBody({
  games,
  status,
  onRetry,
  onViewResults,
}: {
  games: GameListItem[];
  status: MyGamesState["status"];
  onRetry?: () => void;
  onViewResults: (gameId: string, opts?: { shareCode?: string }) => void;
}) {
  if (status === "loading") {
    return (
      <p role="status" className="py-8 text-sm text-on-surface-variant">
        Loading your games…
      </p>
    );
  }
  if (status === "error") {
    return (
      <div role="alert" className="space-y-3 py-8 text-sm text-on-surface">
        <p>Your games couldn&apos;t load. Check your signal and try again.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className={controlClass("outline")}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  if (games.length === 0) {
    return (
      <p className="py-8 text-sm text-on-surface-variant">
        No games yet. Start one above.
      </p>
    );
  }
  return (
    <div className="divide-y divide-outline-variant">
      {games.map((game) => {
        const meta = game.disciplineSlug
          ? DISCIPLINE_META[game.disciplineSlug as DisciplineSlug]
          : undefined;
        const isTerminal = game.status === "complete" || game.status === "cancelled";
        const place = game.spotName ?? game.spotLabel ?? null;
        return (
          <div
            key={game.id}
            className="grid gap-2 py-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"
          >
            {/* Whole row is a pointer shortcut; the Resume/Results control is the one tab stop. */}
            <Link
              href={`/games/${game.id}`}
              tabIndex={-1}
              aria-hidden="true"
              className="grid gap-2 transition-transform hover:translate-x-1 sm:contents"
            >
              <span>
                <span className="block font-display text-2xl font-bold uppercase text-on-surface">
                  {GAME_STATUS_LABEL[game.status]}
                </span>
                <span className="font-display text-xs uppercase tracking-[0.08em] text-secondary">
                  {[
                    GAME_MODE_LABEL[game.mode],
                    place ? `${game.gameName} @ ${place}` : game.gameName,
                    game.nextSpotType,
                  ].join(" / ")}
                  {meta ? (
                    <>
                      {" "}
                      /{" "}
                      <span className="inline-block border border-outline px-1.5 py-0.5 text-secondary">
                        {meta.name}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="font-display text-xs uppercase tracking-[0.08em] text-secondary">
                {game.scheduledStartAt
                  ? new Date(game.scheduledStartAt).toLocaleString()
                  : game.mode === "training"
                    ? "No schedule"
                    : ""}
              </span>
              <span className="font-display text-xl text-on-surface">
                ↗
              </span>
            </Link>
            {isTerminal ? (
              <button
                type="button"
                aria-label={`View results for ${game.gameName}${meta ? ` — ${meta.name}` : ""}`}
                onClick={() => onViewResults(game.id, { shareCode: game.shareCode })}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-on-surface bg-surface-container-lowest px-4 text-sm font-bold uppercase tracking-[0.05em] transition-colors hover:bg-surface-container"
              >
                Results
              </button>
            ) : (
              <Link
                href={`/games/${game.id}`}
                aria-label={`Resume ${game.gameName}`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-primary bg-primary px-4 text-sm font-bold uppercase tracking-[0.05em] text-on-primary transition-colors hover:bg-primary/90"
              >
                Resume
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
