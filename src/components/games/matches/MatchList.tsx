"use client";

import Link from "next/link";
import {
  DISCIPLINE_META,
  type DisciplineSlug,
} from "@/lib/games/discipline";
import type { GameListItem } from "@/lib/schemas/game";
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
  const { games, status } = list ?? ownList;
  const { state: awardState, openForGame, close: closeAward } = useAwardHistory();
  const content = bare ? <ListBody games={games} status={status} onViewResults={openForGame} /> : (
    <>
      <ListBody games={games} status={status} onViewResults={openForGame} />
      {awardState.game && (
        <AwardDialog
          isOpen={awardState.open}
          onClose={closeAward}
          game={awardState.game}
        />
      )}
      {awardState.loading && (
        <p role="status" aria-live="polite" className="py-2 text-sm text-on-surface-variant">
          Loading results…
        </p>
      )}
      {awardState.error && (
        <p role="alert" className="mt-2 rounded-[12px] border border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
          {awardState.error}
        </p>
      )}
    </>
  );
  if (bare) {
    return (
      <>
        {content}
        {awardState.game && (
          <AwardDialog
            isOpen={awardState.open}
            onClose={closeAward}
            game={awardState.game}
          />
        )}
        {awardState.loading && (
          <p role="status" aria-live="polite" className="py-2 text-sm text-on-surface-variant">
            Loading results…
          </p>
        )}
        {awardState.error && (
          <p role="alert" className="mt-2 rounded-[12px] border border-error bg-error-container px-3 py-2 text-sm text-on-error-container">
            {awardState.error}
          </p>
        )}
      </>
    );
  }
  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-on-surface pb-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Your matches
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold uppercase">
            Active & recent
          </h2>
        </div>
        <Link
          href="/games"
          className="font-display text-xs font-bold uppercase tracking-widest underline underline-offset-4"
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
  onViewResults,
}: {
  games: GameListItem[];
  status: MyGamesState["status"];
  onViewResults: (gameId: string, opts?: { shareCode?: string }) => void;
}) {
  if (status === "loading") {
    return (
      <p role="status" className="py-8 text-sm text-on-surface-variant">
        Loading your matches…
      </p>
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="py-8 text-sm text-on-surface">
        Your matches couldn&apos;t load. Check your signal and try again.
      </p>
    );
  }
  if (games.length === 0) {
    return (
      <p className="py-8 text-sm text-on-surface-variant">
        No matches yet. Set the spot for your first game.
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
        return (
          <div
            key={game.id}
            className="grid gap-2 py-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"
          >
            <Link
              href={`/games/${game.id}`}
              className="grid gap-2 transition-transform hover:translate-x-1 sm:contents"
            >
              <span>
                <span className="block font-display text-2xl font-bold uppercase text-on-surface">
                  {game.status}
                </span>
                <span className="font-display text-xs uppercase tracking-[0.08em] text-secondary">
                  {game.mode === "challenge" && game.spotId
                    ? `Spot ${game.spotId.slice(0, 8)} / ${game.nextSpotType}`
                    : `${game.gameName} / ${game.nextSpotType}`}
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
              <span className="font-display text-xl text-on-surface" aria-hidden>
                ↗
              </span>
            </Link>
            {isTerminal ? (
              <button
                type="button"
                aria-label={`View championship results for ${game.gameName} — ${game.disciplineSlug}`}
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
