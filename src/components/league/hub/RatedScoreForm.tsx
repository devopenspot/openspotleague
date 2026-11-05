"use client";

/**
 * Article 9 scoring card: five criteria 0–10 in 0.5 steps, the required
 * elements checklist and (Street) the best trick. Built for phones outdoors
 * (DESIGN.md pages.league): large steppers, 14px+ text. Submit unlocks only
 * when every criterion (and the best trick) is set, so the server never
 * sees a partial score. Scores survive a failed submit.
 */

import { useState } from "react";
import { Info, Minus, Plus } from "lucide-react";
import { InfoPopover } from "@/components/feedback/InfoPopover";
import { BODY, LABEL, TILE, chipClass, controlClass, iconButtonClass } from "@/components/ui/recipes";
import {
  CRITERION_MAX_SCORE,
  CRITERION_STEP,
  RATING_CRITERIA,
  type RatingCriterionKey,
} from "@/lib/league/rating/criteria";
import { elementSetFor } from "@/lib/league/rating/elements";
import type { RatedFormat, RatingDiscipline } from "@/lib/league/rating/formats";
import { elementCountLabel } from "./FormatBrief";

export interface RatedScorePayload {
  scores: Record<RatingCriterionKey, number>;
  elements: string[];
  bestTrick?: { difficulty: number; execution: number };
}

type Draft = Partial<Record<string, number>>;

function clamp(value: number): number {
  return Math.min(CRITERION_MAX_SCORE, Math.max(0, Math.round(value / CRITERION_STEP) * CRITERION_STEP));
}

function Stepper({
  id,
  label,
  value,
  disabled,
  onChange,
  help,
}: {
  id: string;
  label: string;
  value: number | undefined;
  disabled?: boolean;
  onChange: (value: number) => void;
  help?: React.ReactNode;
}) {
  const shown = value ?? null;
  return (
    <div className={TILE}>
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-semibold text-on-surface">
          {label}
        </span>
        {help ? (
          <InfoPopover triggerLabel={`How to score ${label}`} trigger={<Info size={14} aria-hidden="true" />}>
            {help}
          </InfoPopover>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          aria-label={`Lower ${label}`}
          disabled={disabled || shown === null || shown <= 0}
          onClick={() => onChange(clamp((shown ?? 0) - CRITERION_STEP))}
          className={iconButtonClass("outline", "lg")}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <output
          aria-live="polite"
          aria-label={`${label} score`}
          className="min-w-[3.5rem] text-center font-display text-2xl font-bold tabular-nums text-on-surface"
        >
          {shown === null ? "–" : shown.toFixed(1)}
        </output>
        <button
          type="button"
          aria-label={`Raise ${label}`}
          disabled={disabled || (shown !== null && shown >= CRITERION_MAX_SCORE)}
          onClick={() => onChange(clamp(shown === null ? 5 : shown + CRITERION_STEP))}
          className={iconButtonClass("outline", "lg")}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      <p className={`mt-1 text-center ${LABEL}`}>
        {shown === null ? "Not set" : `out of ${CRITERION_MAX_SCORE}`}
      </p>
    </div>
  );
}

export function RatedScoreForm({
  discipline,
  format,
  hasBestTrick,
  initial,
  disabled,
  submitLabel = "Submit score",
  onSubmit,
}: {
  discipline: RatingDiscipline;
  format: RatedFormat;
  hasBestTrick: boolean;
  initial?: { scores: Record<string, number>; elements: string[]; bestTrick: { difficulty: number; execution: number } | null };
  disabled?: boolean;
  submitLabel?: string;
  onSubmit: (payload: RatedScorePayload) => boolean | Promise<boolean>;
}) {
  const [scores, setScores] = useState<Draft>(initial?.scores ?? {});
  const [elements, setElements] = useState<string[]>(initial?.elements ?? []);
  const [trick, setTrick] = useState<Draft>(initial?.bestTrick ?? {});
  const set = elementSetFor(discipline, format);

  const missing = RATING_CRITERIA.filter((criterion) => scores[criterion.key] === undefined).map((c) => c.label);
  const trickMissing = hasBestTrick && (trick.difficulty === undefined || trick.execution === undefined);
  const ready = missing.length === 0 && !trickMissing;
  const average = ready
    ? Math.round((RATING_CRITERIA.reduce((sum, criterion) => sum + (scores[criterion.key] ?? 0), 0) / RATING_CRITERIA.length) * 1000) / 100
    : null;

  const submit = async () => {
    if (!ready || disabled) return;
    const payload: RatedScorePayload = {
      scores: Object.fromEntries(RATING_CRITERIA.map((criterion) => [criterion.key, scores[criterion.key] ?? 0])) as RatedScorePayload["scores"],
      elements,
      ...(hasBestTrick ? { bestTrick: { difficulty: trick.difficulty ?? 0, execution: trick.execution ?? 0 } } : {}),
    };
    await onSubmit(payload);
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold text-on-surface">Criteria</legend>
        <div className="mt-2 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {RATING_CRITERIA.map((criterion) => (
            <Stepper
              key={criterion.key}
              id={`score-${criterion.key}`}
              label={criterion.label}
              value={scores[criterion.key]}
              disabled={disabled}
              onChange={(value) => setScores((current) => ({ ...current, [criterion.key]: value }))}
              help={
                <div className="max-w-xs space-y-2 text-sm">
                  <p className="font-semibold">{criterion.summary}</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {criterion.guidance[format].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-on-surface">Elements you saw</legend>
        <p className={`mt-1 ${BODY}`}>A checklist for the rider. It doesn&apos;t change the score.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {set.elements.map((element) => {
            const active = elements.includes(element.id);
            return (
              <label key={element.id} className={`${chipClass(active)} cursor-pointer`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  disabled={disabled}
                  onChange={() =>
                    setElements((current) =>
                      active ? current.filter((id) => id !== element.id) : [...current, element.id],
                    )
                  }
                />
                {elementCountLabel(element)} × {element.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {hasBestTrick ? (
        <fieldset>
          <legend className="text-sm font-semibold text-on-surface">Best trick</legend>
          <div className="mt-2 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Stepper id="trick-difficulty" label="Trick difficulty" value={trick.difficulty} disabled={disabled} onChange={(value) => setTrick((t) => ({ ...t, difficulty: value }))} />
            <Stepper id="trick-execution" label="Trick execution" value={trick.execution} disabled={disabled} onChange={(value) => setTrick((t) => ({ ...t, execution: value }))} />
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={BODY} aria-live="polite">
          {ready
            ? `Run score ${average?.toFixed(2)} / 100`
            : `Still to score: ${[...missing, ...(trickMissing ? ["Best trick"] : [])].join(", ")}`}
        </p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || disabled}
          className={controlClass("primary", "lg")}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
