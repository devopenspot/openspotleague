"use client";

import Link from "next/link";
import { DISCIPLINE_META, type DisciplineSlug } from "@/lib/games/discipline";
import { gameTitle } from "@/lib/games/game-title";
import {
  matchDateLine,
  matchMetaLine,
  matchStatusLabel,
  matchStatusTone,
} from "@/lib/games/match-labels";
import type { GameListItem } from "@/lib/schemas/game";
import { META, alertClass, controlClass, tagClass } from "@/components/ui/recipes";

export type RowResultsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

const STATUS_TAG = {
  live: tagClass("solid"),
  waiting: tagClass("neutral"),
  done: tagClass("outline"),
} as const;

/** One game in the rider's history: what it was, where it stands, one action. */
export function MatchHistoryRow({
  game,
  results,
  onViewResults,
}: {
  game: GameListItem;
  results: RowResultsState;
  onViewResults: () => void;
}) {
  const meta = game.disciplineSlug
    ? DISCIPLINE_META[game.disciplineSlug as DisciplineSlug]
    : undefined;
  const title = gameTitle(game);
  const isTerminal = game.status === "complete" || game.status === "cancelled";
  const loading = results.kind === "loading";
  const errorId = `match-results-error-${game.id}`;

  return (
    <li className="py-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/games/${game.id}`}
          className="group min-w-0 flex-1 rounded-inner focus-visible:outline-offset-4"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={STATUS_TAG[matchStatusTone(game)]}>
              {matchStatusLabel(game)}
            </span>
            {meta ? <span className={tagClass("neutral")}>{meta.name}</span> : null}
          </span>
          <span className="mt-2 block truncate font-display text-base font-bold uppercase leading-tight tracking-tight text-on-surface group-hover:underline group-hover:underline-offset-4">
            {title}
          </span>
          <span className={`mt-1 block break-words ${META}`}>{matchMetaLine(game)}</span>
          <span className={`mt-0.5 block ${META}`}>{matchDateLine(game)}</span>
        </Link>
        {isTerminal ? (
          <button
            type="button"
            aria-label={`View results for ${title}${meta ? ` — ${meta.name}` : ""}`}
            aria-describedby={results.kind === "error" ? errorId : undefined}
            aria-busy={loading || undefined}
            disabled={loading}
            onClick={onViewResults}
            className={controlClass("outline")}
          >
            {loading ? "Loading…" : "Results"}
          </button>
        ) : (
          <Link
            href={`/games/${game.id}`}
            aria-label={`Resume ${title}`}
            className={controlClass("primary")}
          >
            Resume
          </Link>
        )}
      </div>
      {results.kind === "error" ? (
        <p id={errorId} role="alert" className={`mt-3 text-sm ${alertClass("error")}`}>
          {results.message}
        </p>
      ) : null}
    </li>
  );
}
