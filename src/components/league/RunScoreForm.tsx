"use client";

/**
 * Shared per-criterion scoring form (organizer console RunRow + judge queue).
 * Steppers clamp 0..maxScore; submit requires at least one entered value.
 * The form only resets when `onSubmit` reports success — a failed POST
 * must never wipe the judge's entered scores.
 */

import { useState } from "react";
import type { LeagueEventState } from "@/lib/services/league";

export function RunScoreForm({
  criteria,
  initialScores,
  submitLabel = "Submit score",
  disabled,
  onSubmit,
}: {
  criteria: LeagueEventState["criteria"];
  initialScores?: Record<string, number>;
  submitLabel?: string;
  disabled?: boolean;
  /** Return true when the submission succeeded; false keeps the scores. */
  onSubmit: (scores: Record<string, number>) => boolean | Promise<boolean>;
}) {
  const [scores, setScores] = useState<Record<string, number>>(initialScores ?? {});
  const canScore = !disabled && Object.keys(scores).length > 0;

  const setScore = (key: string, value: number) =>
    setScores((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {criteria.map((criterion) => {
        return (
          <div
            key={criterion.key}
            className="rounded-md border border-outline-variant bg-surface-container-low p-2"
          >
            <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
              {criterion.label}
            </p>
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label={`Decrease ${criterion.label}`}
                onClick={() =>
                  setScore(
                    criterion.key,
                    Math.max(0, (scores[criterion.key] ?? 0) - 1),
                  )
                }
                className="h-11 w-11 rounded-full border border-outline-variant text-sm font-bold text-on-surface hover:border-outline disabled:opacity-40"
                disabled={disabled}
              >
                −
              </button>
              <span className="min-w-6 text-center font-display text-sm font-bold text-on-surface">
                {scores[criterion.key] ?? 0}
              </span>
              <button
                type="button"
                aria-label={`Increase ${criterion.label}`}
                aria-describedby={`criterion-${criterion.key}-max`}
                onClick={() =>
                  setScore(
                    criterion.key,
                    Math.min(
                      criterion.maxScore,
                      (scores[criterion.key] ?? 0) + 1,
                    ),
                  )
                }
                className="h-11 w-11 rounded-full border border-outline-variant text-sm font-bold text-on-surface hover:border-outline disabled:opacity-40"
                disabled={disabled}
              >
                +
              </button>
            </div>
            <p id={`criterion-${criterion.key}-max`} className="sr-only">
              0 to {criterion.maxScore}
            </p>
          </div>
        );
      })}
      <button
        type="button"
        disabled={!canScore}
        onClick={() => {
          void (async () => {
            const result = await onSubmit(scores);
            if (result) setScores({});
          })();
        }}
        className="col-span-2 min-h-11 rounded-full bg-primary px-4 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-on-primary hover:opacity-90 disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  );
}
