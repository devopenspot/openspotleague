"use client";

/**
 * Shared per-criterion scoring form (organizer console RunRow + judge queue).
 * Steppers clamp 0..maxScore; submit unlocks once every criterion is set.
 * The form only resets when `onSubmit` reports success — a failed POST
 * must never wipe the judge's entered scores.
 */

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { LeagueEventState } from "@/lib/services/league";
import {
  TILE,
  controlClass,
  iconButtonClass,
} from "@/components/ui/recipes";

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
  // Every criterion is required server-side; never send a partial score.
  const canScore =
    !disabled && criteria.every((criterion) => typeof scores[criterion.key] === "number");

  const setScore = (key: string, value: number) =>
    setScores((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {criteria.map((criterion) => {
        return (
          <div
            key={criterion.key}
            className={TILE}
          >
            <p className="mb-2 font-display text-sm font-bold uppercase leading-tight tracking-label text-on-surface">
              {criterion.label}
            </p>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={`Decrease ${criterion.label}`}
                onClick={() =>
                  setScore(
                    criterion.key,
                    Math.max(0, (scores[criterion.key] ?? 0) - 1),
                  )
                }
                className={iconButtonClass("outline", "lg")}
                disabled={disabled}
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <span
                aria-live="polite"
                className="min-w-10 text-center font-display text-2xl font-bold tabular-nums text-on-surface"
              >
                {scores[criterion.key] ?? 0}
                <span className="sr-only"> of {criterion.maxScore}</span>
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
                className={iconButtonClass("outline", "lg")}
                disabled={disabled}
              >
                <Plus size={18} aria-hidden="true" />
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
        className={`col-span-full ${controlClass("primary", "lg")}`}
      >
        {submitLabel}
      </button>
    </div>
  );
}
