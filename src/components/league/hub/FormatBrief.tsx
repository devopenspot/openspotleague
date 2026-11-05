/**
 * Rules brief per division: what the run is, how it is judged (the five
 * Article 9 criteria with per-format guidance) and the required elements.
 * Read by riders before filming/riding and by judges before scoring.
 */
import { CheckCircle2, Timer, Trophy } from "lucide-react";
import { BODY, CARD, CARD_NESTED, CARD_TITLE, EYEBROW, LABEL, tagClass } from "@/components/ui/recipes";
import { CRITERION_MAX_SCORE, CRITERION_STEP, RATING_CRITERIA } from "@/lib/league/rating/criteria";
import { elementSetFor, type RequiredElement } from "@/lib/league/rating/elements";
import { FORMAT_TEMPLATES, isRatedFormat, isRatingDiscipline } from "@/lib/league/rating/formats";
import { TRIM_MIN_JUDGES } from "@/lib/league/rating/scoring";
import type { LeagueEventState } from "@/lib/services/league";

type Division = LeagueEventState["divisions"][number];

export function elementCountLabel(element: RequiredElement): string {
  return element.min === element.max ? `${element.min}` : `${element.min}–${element.max}`;
}

export function FormatBrief({
  divisions,
  submissionMode,
}: {
  divisions: Division[];
  submissionMode: "live" | "video";
}) {
  return (
    <div className="space-y-5">
      <section className={CARD} aria-labelledby="brief-scoring">
        <h3 id="brief-scoring" className={CARD_TITLE}>
          How runs are scored
        </h3>
        <p className={`mt-2 ${BODY}`}>
          Each judge scores five criteria from 0 to {CRITERION_MAX_SCORE} in steps of {CRITERION_STEP}. A
          judge&apos;s run score is the average of the five, shown out of 100. With {TRIM_MIN_JUDGES} or
          more judges the highest and lowest scores are dropped. Required elements are a checklist: missing
          one doesn&apos;t cost points by itself, but it usually lowers difficulty and creativity.
        </p>
        <p className={`mt-2 ${BODY}`}>
          {submissionMode === "video"
            ? "This is a video contest: film one clean run and paste the link before the deadline."
            : "This contest is judged live: ride your run when the organizer opens your window."}
        </p>
      </section>

      {divisions.map((division) => (
        <DivisionBrief key={division.id} division={division} />
      ))}
    </div>
  );
}

function DivisionBrief({ division }: { division: Division }) {
  const rated = isRatedFormat(division.format) && isRatingDiscipline(division.disciplineSlug);
  return (
    <section className={CARD} aria-labelledby={`brief-${division.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`brief-${division.id}`} className={CARD_TITLE}>
          {division.label}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {division.runSeconds ? (
            <span className={tagClass("outline")}>
              <Timer size={12} aria-hidden="true" />
              {division.runSeconds}s run
            </span>
          ) : null}
          {division.hasBestTrick ? (
            <span className={tagClass("outline")}>
              <Trophy size={12} aria-hidden="true" />
              Best trick
            </span>
          ) : null}
        </div>
      </div>

      {!rated ? (
        <p className={`mt-3 ${BODY}`}>
          This division uses the contest&apos;s original scoring criteria.
        </p>
      ) : (
        <RatedBrief division={division} />
      )}
    </section>
  );
}

function RatedBrief({ division }: { division: Division }) {
  if (!isRatedFormat(division.format) || !isRatingDiscipline(division.disciplineSlug)) return null;
  const format = division.format;
  const template = FORMAT_TEMPLATES[format];
  const set = elementSetFor(division.disciplineSlug, format);
  return (
    <div className="mt-3 space-y-4">
      <p className={BODY}>{template.summary}</p>
      {template.hasBestTrick ? (
        <p className={BODY}>
          Also show one solid best trick. It gets its own score (difficulty and execution), breaks ties and
          has its own board.
        </p>
      ) : null}

      <div>
        <p className={EYEBROW}>Required elements</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {set.elements.map((element) => (
            <li key={element.id} className={`${CARD_NESTED} flex gap-3`}>
              <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-secondary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface">
                  {elementCountLabel(element)} × {element.label}
                </p>
                {element.preferred ? <p className={`mt-0.5 ${LABEL}`}>{element.preferred}</p> : null}
              </div>
            </li>
          ))}
        </ul>
        {!set.reviewed ? (
          <p className={`mt-2 ${LABEL}`}>Draft list for this discipline — subject to change.</p>
        ) : null}
      </div>

      <details className={CARD_NESTED}>
        <summary className="cursor-pointer text-sm font-semibold text-on-surface">What judges look for</summary>
        <dl className="mt-3 space-y-3">
          {RATING_CRITERIA.map((criterion) => (
            <div key={criterion.key}>
              <dt className="text-sm font-semibold text-on-surface">{criterion.label}</dt>
              <dd className={`mt-0.5 ${BODY}`}>{criterion.summary}</dd>
              <dd>
                <ul className={`mt-1 list-disc space-y-0.5 pl-5 ${BODY}`}>
                  {criterion.guidance[format].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {set.examples.length > 0 ? (
        <details className={CARD_NESTED}>
          <summary className="cursor-pointer text-sm font-semibold text-on-surface">Example tricks</summary>
          <div className="mt-3 space-y-3">
            {set.examples.map((tier) => (
              <div key={tier.label}>
                <p className={LABEL}>{tier.label}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {tier.tricks.map((trick) => (
                    <li key={trick} className={tagClass("neutral")}>
                      {trick}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
