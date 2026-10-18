"use client";

import { motion, useReducedMotion } from "motion/react";
import type { AwardResult } from "@/lib/games/award-result";

type Props = {
  result: AwardResult;
};

function SoloResultCard({ result }: { result: AwardResult }) {
  const row = result.soloRow;
  if (!row) return null;
  return (
    <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-6 text-center">
      <p className="font-display text-lg font-bold">{row.displayName}</p>
      <p className="mt-1 text-sm text-on-surface-variant">
        {row.landed} landed · {row.failed} missed
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{row.points} pts</p>
      <span className="mt-3 inline-flex rounded-full bg-surface-container-high px-3 py-1 text-[11px] font-bold uppercase tracking-[0.05em]">
        {result.disciplineSlug}
      </span>
    </div>
  );
}

export function AwardResultsTable({ result }: Props) {
  const reduced = useReducedMotion();
  if (result.variant === "solo" && result.soloRow) {
    return <SoloResultCard result={result} />;
  }

  if (result.ranking.length === 0) return null;

  const word = result.ranking[0]?.eliminationProgress.includes("/") ? result.ranking[0]?.eliminationProgress.split("/")[1]?.trim() : null;
  const wordLength = word ? word.length : null;

  return (
    <section aria-labelledby="award-results-caption">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[16px] border border-outline-variant md:block">
        <table role="table" className="w-full text-sm">
          <caption id="award-results-caption" className="sr-only">
            Championship results — ranked by points
          </caption>
          <thead className="bg-surface-container-high text-xs uppercase tracking-[0.05em] text-on-surface-variant">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Rank
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Rider
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Letters
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Pts
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                W–L
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {result.ranking.map((row, index) => {
              const isWinner = row.isWinner;
              const isViewer = row.isViewer;
              const rowClass = [
                isWinner ? "bg-primary-container/18 border-primary/20" : "",
                isViewer ? "ring-1 ring-inset ring-outline-variant" : "",
                !isWinner && !isViewer ? "odd:bg-surface even:bg-surface-container-low" : "",
              ].join(" ");
              const rankClass = [
                "px-4 py-3 font-mono text-sm font-bold tabular-nums",
                isWinner ? "text-primary" : "text-on-surface-variant",
              ].join(" ");
              const rowContent = (
                <>
                  <td className={rankClass}>{row.rank}</td>
                  <th scope="row" className="px-4 py-3 text-left">
                    <span className="flex items-center gap-2">
                      <span className="max-w-[14ch] truncate font-semibold">{row.displayName}</span>
                      {isViewer && (
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                          You
                        </span>
                      )}
                      {isWinner && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-primary">
                          Winner
                        </span>
                      )}
                    </span>
                  </th>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.eliminated ? (
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                        eliminated
                      </span>
                    ) : row.eliminationProgress ? (
                      row.eliminationProgress
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums">{row.points}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {row.landed}–{row.failed}
                  </td>
                </>
              );
              if (reduced) {
                return (
                  <tr key={row.playerId} className={rowClass}>
                    {rowContent}
                  </tr>
                );
              }
              return (
                <motion.tr
                  key={row.playerId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.18 }}
                  className={rowClass}
                >
                  {rowContent}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div role="list" className="flex flex-col gap-3 md:hidden">
        {result.ranking.map((row, index) => {
          const isWinner = row.isWinner;
          const isViewer = row.isViewer;
          const lettersLen = row.letters.length;
          const totalLen = wordLength ?? (row.eliminationProgress.includes("/") ? row.eliminationProgress.split("/")[1]?.trim().length ?? lettersLen : lettersLen);
          const progress = totalLen > 0 ? (lettersLen / totalLen) * 100 : 0;
          const cardClass = [
            "rounded-[16px] border bg-surface-container-lowest p-3 flex flex-col gap-2",
            isWinner ? "border-primary/30 bg-primary-container/10" : "border-outline-variant",
            isViewer ? "ring-1 ring-outline-variant" : "",
          ].join(" ");
          const cardContent = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                    isWinner ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant",
                  ].join(" ")}
                >
                  {row.rank}
                </span>
                <span className="flex-1 truncate font-semibold text-sm">{row.displayName}</span>
                {isViewer && (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">You</span>
                )}
                {isWinner && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-primary">Winner</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-on-surface-variant">
                    {row.eliminationProgress || "—"}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums">{row.points} pts</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-container-high">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-on-surface-variant">
                  <span>
                    {row.landed}–{row.failed} W–L
                  </span>
                  {row.eliminated && <span className="font-bold uppercase tracking-widest">eliminated</span>}
                </div>
              </div>
            </>
          );
          if (reduced) {
            return (
              <div
                key={row.playerId}
                role="listitem"
                aria-label={`Rank ${row.rank} of ${result.ranking.length}`}
                className={cardClass}
              >
                {cardContent}
              </div>
            );
          }
          return (
            <motion.div
              key={row.playerId}
              role="listitem"
              aria-label={`Rank ${row.rank} of ${result.ranking.length}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.18 }}
              className={cardClass}
            >
              {cardContent}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
