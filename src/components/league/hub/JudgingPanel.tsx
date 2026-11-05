"use client";

/**
 * Judging tab (judges and organizers). A queue per division — Next,
 * Waiting, Done — and one scoring card. Video contests open the rider's
 * link; live contests score inside the open window, and organizers run the
 * windows from here (open next, extend, close) so judging never needs a
 * second page.
 */

import { useMemo, useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { RunScoreForm } from "@/components/league/RunScoreForm";
import { BODY, CARD, CARD_NESTED, CARD_TITLE, EMPTY_STATE, EYEBROW, LABEL, META, controlClass, tagClass } from "@/components/ui/recipes";
import { divisionLabelFor, runStatusLabel, runsAwaitingMyScore } from "@/lib/league/hub-state";
import { isRatedFormat, isRatingDiscipline } from "@/lib/league/rating/formats";
import { formatCountdown, isOrganizerRole } from "@/lib/league/ui-state";
import type { LeagueEventState } from "@/lib/services/league";
import { RatedScoreForm, type RatedScorePayload } from "./RatedScoreForm";
import type { ContestStateApi } from "./useContestState";
import { useNow } from "./useNow";

type Run = LeagueEventState["runs"][number];

export function JudgingPanel({ api }: { api: ContestStateApi }) {
  const state = api.state!;
  const now = useNow();
  const organizer = isOrganizerRole(state.myRole);
  const video = state.event.submissionMode === "video";
  const awaiting = useMemo(() => runsAwaitingMyScore(state, now), [state, now]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    state.runs.find((run) => run.id === selectedId) ?? awaiting[0] ?? null;

  const myScore = (run: Run) => run.scores.find((score) => score.judgeUserId === state.myUserId) ?? null;
  const done = state.runs.filter((run) => myScore(run) !== null);
  const waiting = state.runs.filter(
    (run) => myScore(run) === null && !awaiting.some((candidate) => candidate.id === run.id) && run.status !== "skipped",
  );
  const nextScheduled = state.runs.find((run) => run.status === "scheduled") ?? null;

  if (state.event.status !== "live" && done.length === 0) {
    return (
      <div className={EMPTY_STATE}>
        <p className={CARD_TITLE}>Judging opens when the contest starts</p>
        <p className={`mx-auto mt-2 max-w-md ${BODY}`}>
          Read the Overview tab to learn each division&apos;s criteria and required elements before then.
        </p>
      </div>
    );
  }

  const submitScore = async (run: Run, payload: RatedScorePayload | { scores: Record<string, number> }) => {
    const ok = await api.mutate(`/runs/${run.id}/scores`, "POST", payload as unknown as Record<string, unknown>);
    if (ok) setSelectedId(null);
    return ok;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {organizer && !video && state.event.status === "live" ? (
          <LiveWindowControls api={api} openRun={state.runs.find((run) => run.status === "judging") ?? null} next={nextScheduled} now={now} />
        ) : null}

        {selected ? (
          <ScoringCard
            key={selected.id}
            state={state}
            run={selected}
            now={now}
            existing={myScore(selected)}
            disabled={api.busy || state.readOnly}
            onSubmit={(payload) => submitScore(selected, payload)}
          />
        ) : (
          <div className={EMPTY_STATE}>
            <p className={CARD_TITLE}>You&apos;re up to date</p>
            <p className={`mx-auto mt-2 max-w-md ${BODY}`}>
              {video
                ? "New runs appear here as riders submit their videos."
                : "The next run appears here when its judging window opens."}
            </p>
          </div>
        )}
      </div>

      <aside aria-label="Judging queue" className="space-y-4">
        <QueueList title={`To score (${awaiting.length})`} runs={awaiting} state={state} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        <QueueList title={`Waiting (${waiting.length})`} runs={waiting} state={state} selectedId={selected?.id ?? null} />
        <QueueList title={`Scored by you (${done.length})`} runs={done} state={state} selectedId={selected?.id ?? null} onSelect={state.event.status === "live" ? setSelectedId : undefined} />
      </aside>
    </div>
  );
}

function QueueList({
  title,
  runs,
  state,
  selectedId,
  onSelect,
}: {
  title: string;
  runs: Run[];
  state: LeagueEventState;
  selectedId: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <section className={CARD}>
      <h3 className={EYEBROW}>{title}</h3>
      {runs.length === 0 ? (
        <p className={`mt-2 ${LABEL}`}>Nothing here.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {runs.map((run) => {
            const content = (
              <>
                <span className="min-w-0 truncate text-sm font-semibold text-on-surface">
                  #{run.sequence} {run.riderName}
                </span>
                <span className={LABEL}>
                  {divisionLabelFor(state, run.divisionId)} · {runStatusLabel(run.status, state.event.submissionMode)}
                </span>
              </>
            );
            return (
              <li key={run.id}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(run.id)}
                    aria-current={selectedId === run.id ? "true" : undefined}
                    className={`flex w-full flex-col items-start rounded-inner px-3 py-2 text-left hover:bg-surface-container ${selectedId === run.id ? "bg-surface-container" : ""}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex flex-col px-3 py-2">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ScoringCard({
  state,
  run,
  now,
  existing,
  disabled,
  onSubmit,
}: {
  state: LeagueEventState;
  run: Run;
  now: Date;
  existing: Run["scores"][number] | null;
  disabled: boolean;
  onSubmit: (payload: RatedScorePayload | { scores: Record<string, number> }) => Promise<boolean>;
}) {
  const division = state.divisions.find((candidate) => candidate.id === run.divisionId);
  const remaining = run.windowEndsAt ? new Date(run.windowEndsAt).getTime() - now.getTime() : null;
  const live = state.event.submissionMode === "live";
  const windowClosed = live && (run.status !== "judging" || remaining === null || remaining <= 0);
  const rated =
    division && isRatedFormat(division.format) && isRatingDiscipline(division.disciplineSlug) ? division : null;

  return (
    <section className={CARD} aria-labelledby="scoring-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={EYEBROW}>{division?.label ?? "Run"} · Run {run.sequence}</p>
          <h3 id="scoring-title" className="mt-1 font-display text-2xl font-bold uppercase tracking-display text-on-surface">
            {run.riderName}
          </h3>
          <p className={`mt-1 ${META}`}>
            {[run.riderAgeCategory === "junior" ? "Junior" : run.riderAgeCategory === "senior" ? "Senior" : null, run.riderCity]
              .filter(Boolean)
              .join(" · ") || " "}
          </p>
        </div>
        {live ? (
          <span className={tagClass(windowClosed ? "outline" : "solid", "lg")} aria-live="polite">
            {windowClosed ? "Window closed" : `${formatCountdown(remaining ?? 0)} left`}
          </span>
        ) : null}
      </div>

      {!live ? (
        <div className={`mt-4 flex flex-wrap gap-2 ${CARD_NESTED}`}>
          {run.videoUrl ? (
            <a href={run.videoUrl} target="_blank" rel="noopener noreferrer" className={controlClass("secondary")}>
              <Video size={16} aria-hidden="true" /> Watch run
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : (
            <p className={BODY}>No video yet.</p>
          )}
          {run.bestTrickVideoUrl ? (
            <a href={run.bestTrickVideoUrl} target="_blank" rel="noopener noreferrer" className={controlClass("outline")}>
              Watch best trick
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {windowClosed && !existing ? (
          <p className={BODY}>This run&apos;s window is closed, so it can&apos;t be scored.</p>
        ) : rated && isRatedFormat(rated.format) && isRatingDiscipline(rated.disciplineSlug) ? (
          <RatedScoreForm
            discipline={rated.disciplineSlug}
            format={rated.format}
            hasBestTrick={rated.hasBestTrick}
            initial={existing ? { scores: existing.criteria, elements: existing.elements, bestTrick: existing.bestTrick } : undefined}
            disabled={disabled || windowClosed}
            submitLabel={existing ? "Update score" : "Submit score"}
            onSubmit={onSubmit}
          />
        ) : (
          <RunScoreForm
            criteria={state.criteria}
            initialScores={existing?.criteria}
            submitLabel={existing ? "Update score" : "Submit score"}
            disabled={disabled || windowClosed}
            onSubmit={(scores) => onSubmit({ scores })}
          />
        )}
      </div>
    </section>
  );
}

function LiveWindowControls({
  api,
  openRun,
  next,
  now,
}: {
  api: ContestStateApi;
  openRun: Run | null;
  next: Run | null;
  now: Date;
}) {
  const remaining = openRun?.windowEndsAt ? new Date(openRun.windowEndsAt).getTime() - now.getTime() : 0;
  return (
    <section className={`${CARD} flex flex-wrap items-center justify-between gap-3`} aria-label="Run windows">
      <div className="min-w-0">
        <p className={EYEBROW}>Run of show</p>
        <p className="mt-1 text-sm font-semibold text-on-surface">
          {openRun
            ? `Now: #${openRun.sequence} ${openRun.riderName} · ${formatCountdown(Math.max(0, remaining))} left`
            : next
              ? `Next: #${next.sequence} ${next.riderName}`
              : "All runs are done"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {openRun ? (
          <>
            <button type="button" disabled={api.busy} onClick={() => void api.mutate(`/runs/${openRun.id}/window`, "POST", { mode: "extend", windowMinutes: 5 })} className={controlClass("outline")}>
              +5 min
            </button>
            <button type="button" disabled={api.busy} onClick={() => void api.mutate(`/runs/${openRun.id}/window`, "POST", { mode: "close" })} className={controlClass("secondary")}>
              Close window
            </button>
          </>
        ) : next ? (
          <button type="button" disabled={api.busy} onClick={() => void api.mutate(`/runs/${next.id}/window`, "POST", { mode: "open", windowMinutes: 10 })} className={controlClass("primary")}>
            Open next run
          </button>
        ) : null}
      </div>
    </section>
  );
}
