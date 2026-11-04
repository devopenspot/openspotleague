"use client";

import { motion, useReducedMotion } from "motion/react";
import type { AwardResult, AwardResultRow } from "@/lib/games/award-result";
import { LetterTrack } from "@/components/games/shared/LetterTrack";
import { CARD, tagClass } from "@/components/ui/recipes";

type Props = {
  result: AwardResult;
};

/** "4 landed · 2 missed" — the attempt split, not wins and losses. */
export function attemptsLabel(row: Pick<AwardResultRow, "landed" | "failed">): string {
  return `${row.landed} landed · ${row.failed} missed`;
}

function SoloResultCard({ row }: { row: AwardResultRow }) {
  return (
    <div className={`${CARD} text-center`}>
      <p className="font-display text-base font-bold text-on-surface">{row.displayName}</p>
      <p className="mt-1 font-display text-sm font-bold uppercase tracking-label text-secondary">
        Session score
      </p>
      <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-on-surface">
        {row.points}
        <span className="ml-1 text-base font-semibold text-on-surface-variant">pts</span>
      </p>
      <p className="mt-2 text-sm text-on-surface-variant">{attemptsLabel(row)}</p>
    </div>
  );
}

function rowFrame(row: AwardResultRow): string {
  if (row.isWinner) return "border-on-surface bg-surface-container-low";
  if (row.isViewer) return "border-primary bg-surface-container-lowest";
  return "border-outline-variant bg-surface-container-lowest";
}

function StandingRow({
  row,
  eliminationWord,
}: {
  row: AwardResultRow;
  eliminationWord: string | null;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control font-mono text-sm font-bold tabular-nums ${
            row.isWinner
              ? "bg-on-surface text-surface"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          <span className="sr-only">Rank </span>
          {row.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-display text-base font-bold text-on-surface">
              {row.displayName}
            </span>
            {row.isWinner && <span className={tagClass("solid", "lg")}>Winner</span>}
            {row.isViewer && <span className={tagClass("neutral", "lg")}>You</span>}
            {row.eliminated && <span className={tagClass("outline", "lg")}>Out</span>}
          </p>
          <p className="mt-0.5 text-sm text-on-surface-variant">{attemptsLabel(row)}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="font-mono text-base font-bold tabular-nums text-on-surface">
            {row.points}
          </span>
          <span className="ml-1 text-sm text-on-surface-variant">pts</span>
        </p>
      </div>
      {eliminationWord && (
        <LetterTrack
          word={eliminationWord}
          letters={row.letters}
          label={`${row.displayName}: ${row.letters.length} of ${eliminationWord.length} letters`}
          className="pl-12"
        />
      )}
    </>
  );
}

export function AwardResultsTable({ result }: Props) {
  const reduced = useReducedMotion();
  if (result.variant === "solo") {
    return result.soloRow ? <SoloResultCard row={result.soloRow} /> : null;
  }
  if (result.ranking.length === 0) return null;

  return (
    <section aria-labelledby="award-results-caption">
      <h3 id="award-results-caption" className="sr-only">
        Final standings — ranked by points
      </h3>
      <ol className="flex flex-col gap-3">
        {result.ranking.map((row, index) => {
          const className = `flex flex-col gap-3 rounded-inner border p-3 sm:p-4 ${rowFrame(row)}`;
          const content = (
            <StandingRow row={row} eliminationWord={result.eliminationWord} />
          );
          if (reduced) {
            return (
              <li key={row.playerId} className={className}>
                {content}
              </li>
            );
          }
          return (
            <motion.li
              key={row.playerId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.18 }}
              className={className}
            >
              {content}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
