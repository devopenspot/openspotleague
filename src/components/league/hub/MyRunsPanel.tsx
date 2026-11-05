"use client";

/**
 * Rider tab: my entry (divisions, category, city), then one card per run —
 * the required-elements checklist, the start time or the video form, a
 * readable status, the provisional panel score and, once published, rank,
 * points, element completion and the share card.
 */

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, LogOut, Share2, Video } from "lucide-react";
import { Countdown } from "@/components/ui/Countdown";
import {
  BODY,
  CARD,
  CARD_NESTED,
  CARD_TITLE,
  EMPTY_STATE,
  EYEBROW,
  INPUT,
  LABEL,
  META,
  TILE,
  alertClass,
  chipClass,
  controlClass,
  tagClass,
} from "@/components/ui/recipes";
import { divisionLabelFor, myRuns, runStatusLabel } from "@/lib/league/hub-state";
import { elementSetFor } from "@/lib/league/rating/elements";
import { isRatedFormat, isRatingDiscipline } from "@/lib/league/rating/formats";
import { elementCompletion } from "@/lib/league/rating/scoring";
import { VIDEO_HOST_LABELS, isAllowedVideoUrl } from "@/lib/league/rating/video-links";
import { buildContestResultUrl } from "@/lib/league/urls";
import type { LeagueEventState } from "@/lib/services/league";
import { elementCountLabel } from "./FormatBrief";
import type { ContestStateApi } from "./useContestState";
import { useNow } from "./useNow";

type Run = LeagueEventState["runs"][number];

const ENTRY_EDITABLE = new Set(["draft", "registration_open"]);

export function MyRunsPanel({ api }: { api: ContestStateApi }) {
  const state = api.state!;
  const runs = myRuns(state);
  const editable = ENTRY_EDITABLE.has(state.event.status);
  const [editing, setEditing] = useState(editable && (state.myEntry?.ageCategory ?? null) === null);

  return (
    <div className="space-y-5">
      {editing && editable ? (
        <EntryForm api={api} onDone={() => setEditing(false)} />
      ) : (
        <EntrySummary state={state} editable={editable} onEdit={() => setEditing(true)} />
      )}

      {runs.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p className={CARD_TITLE}>Your runs appear here</p>
          <p className={`mx-auto mt-2 max-w-md ${BODY}`}>
            {state.event.submissionMode === "video"
              ? "Once the organizer prepares the runs you'll get one card per division to paste your video link."
              : "Once the organizer publishes the start order you'll see your time slot for each division."}
          </p>
        </div>
      ) : (
        runs.map((run) => <RunCard key={run.id} api={api} run={run} />)
      )}

      {state.event.status === "draft" || state.event.status === "registration_open" ? (
        <LeaveContest api={api} />
      ) : null}
    </div>
  );
}

function EntrySummary({ state, editable, onEdit }: { state: LeagueEventState; editable: boolean; onEdit: () => void }) {
  const entry = state.myEntry;
  const divisions = (entry?.divisionIds ?? []).map((id) => divisionLabelFor(state, id));
  return (
    <section className={`${CARD} flex flex-wrap items-start justify-between gap-3`} aria-labelledby="my-entry">
      <div className="min-w-0">
        <h3 id="my-entry" className={CARD_TITLE}>
          My entry
        </h3>
        <p className={`mt-1 ${META}`}>
          {[
            divisions.length > 0 ? divisions.join(", ") : "No division picked",
            entry?.ageCategory ? (entry.ageCategory === "junior" ? "Junior" : "Senior") : null,
            entry?.city,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {editable ? (
        <button type="button" onClick={onEdit} className={controlClass("outline")}>
          Edit my entry
        </button>
      ) : null}
    </section>
  );
}

function EntryForm({ api, onDone }: { api: ContestStateApi; onDone: () => void }) {
  const state = api.state!;
  const [divisionIds, setDivisionIds] = useState<string[]>(
    state.myEntry?.divisionIds.length ? state.myEntry.divisionIds : state.divisions.length === 1 ? [state.divisions[0]!.id] : [],
  );
  const [ageCategory, setAgeCategory] = useState<"junior" | "senior" | "">(state.myEntry?.ageCategory ?? "");
  const [gender, setGender] = useState(state.myEntry?.gender ?? "");
  const [city, setCity] = useState(state.myEntry?.city ?? "");
  const ready = divisionIds.length > 0 && ageCategory !== "";

  const save = async () => {
    if (!ready) return;
    const ok = await api.mutate("/entry", "PATCH", {
      entry: {
        divisionIds,
        ageCategory,
        ...(gender.trim() ? { gender: gender.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      },
    });
    if (ok) onDone();
  };

  return (
    <section className={CARD} aria-labelledby="entry-form">
      <h3 id="entry-form" className={CARD_TITLE}>
        Your entry
      </h3>
      <p className={`mt-1 ${BODY}`}>Pick the divisions you&apos;ll ride and your category. You can change this until registration closes.</p>

      <fieldset className="mt-4">
        <legend className={LABEL}>Divisions</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.divisions.map((division) => {
            const active = divisionIds.includes(division.id);
            return (
              <label key={division.id} className={`${chipClass(active)} cursor-pointer`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  onChange={() =>
                    setDivisionIds((current) =>
                      active ? current.filter((id) => id !== division.id) : [...current, division.id],
                    )
                  }
                />
                {division.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className={LABEL}>Category</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              { value: "junior", label: "Junior (8–16)" },
              { value: "senior", label: "Senior (12+)" },
            ] as const
          ).map((option) => (
            <label key={option.value} className={`${chipClass(ageCategory === option.value)} cursor-pointer`}>
              <input
                type="radio"
                name="age-category"
                className="sr-only"
                checked={ageCategory === option.value}
                onChange={() => setAgeCategory(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className={`mt-1 ${LABEL}`}>Riders aged 12–16 can choose either.</p>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>City (optional)</span>
          <input value={city} maxLength={80} onChange={(event) => setCity(event.target.value)} className={`mt-1 ${INPUT}`} autoComplete="address-level2" />
        </label>
        <label className="block">
          <span className={LABEL}>Gender (optional)</span>
          <input value={gender} maxLength={40} onChange={(event) => setGender(event.target.value)} className={`mt-1 ${INPUT}`} />
        </label>
      </div>

      {api.actionError ? <p role="alert" className={`mt-4 text-sm ${alertClass("error")}`}>{api.actionError}</p> : null}

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={!ready || api.busy} onClick={() => void save()} className={controlClass("primary")}>
          Save my entry
        </button>
      </div>
    </section>
  );
}

function RunCard({ api, run }: { api: ContestStateApi; run: Run }) {
  const state = api.state!;
  const division = state.divisions.find((candidate) => candidate.id === run.divisionId);
  const rated = division && isRatedFormat(division.format) && isRatingDiscipline(division.disciplineSlug) ? division : null;
  const elementSet = rated && isRatedFormat(rated.format) && isRatingDiscipline(rated.disciplineSlug) ? elementSetFor(rated.disciplineSlug, rated.format) : null;
  const result = state.results.find((entry) => entry.divisionId === run.divisionId && entry.userId === state.myUserId) ?? null;
  const published = state.event.resultsPublished;
  const completion =
    published && elementSet
      ? elementCompletion(
          elementSet.elements.map((element) => element.id),
          run.scores.map((score) => score.elements),
        )
      : null;

  return (
    <section className={CARD} aria-labelledby={`run-${run.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`run-${run.id}`} className={CARD_TITLE}>
          {division?.label ?? "Run"}
        </h3>
        <span className={tagClass(run.status === "scored" ? "solid" : "outline")}>
          {runStatusLabel(run.status, state.event.submissionMode)}
        </span>
      </div>

      {published && result ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
          <div className={TILE}>
            <dt className={LABEL}>Rank</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums">#{result.rank}</dd>
          </div>
          <div className={TILE}>
            <dt className={LABEL}>Score</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums">{result.totalScore.toFixed(2)}</dd>
          </div>
          <div className={TILE}>
            <dt className={LABEL}>League pts</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums">+{result.pointsAwarded}</dd>
          </div>
        </dl>
      ) : run.panelScore !== null ? (
        <p className={`mt-3 ${BODY}`}>
          Provisional score <strong className="text-on-surface tabular-nums">{run.panelScore.toFixed(2)}</strong> from{" "}
          {run.judgedCount} judge{run.judgedCount === 1 ? "" : "s"}. It can change until results are published.
        </p>
      ) : null}

      {state.event.submissionMode === "live" && run.scheduledAt && !published ? (
        <p className={`mt-3 flex items-center gap-2 ${BODY}`}>
          <Clock size={14} aria-hidden="true" />
          Start #{run.sequence} ·{" "}
          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: state.event.timezone }).format(new Date(run.scheduledAt))}
        </p>
      ) : null}

      {state.event.submissionMode === "video" && !published ? <VideoForm api={api} run={run} hasBestTrick={Boolean(division?.hasBestTrick)} /> : null}

      {elementSet ? (
        <div className="mt-4">
          <p className={EYEBROW}>{completion ? "Elements the judges saw" : "Show these in your run"}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {elementSet.elements.map((element) => {
              const shown = completion?.find((entry) => entry.elementId === element.id)?.shown;
              return (
                <li key={element.id} className={`${CARD_NESTED} flex gap-3`}>
                  {shown ? (
                    <CheckCircle2 size={16} aria-label="Shown" className="mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <Circle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-secondary" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {elementCountLabel(element)} × {element.label}
                    </p>
                    {element.preferred ? <p className={`mt-0.5 ${LABEL}`}>{element.preferred}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {published && result ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={buildContestResultUrl(state.event.slug, state.myUserId)} className={controlClass("primary")}>
            <Share2 size={14} aria-hidden="true" /> Share my result
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function VideoForm({ api, run, hasBestTrick }: { api: ContestStateApi; run: Run; hasBestTrick: boolean }) {
  const state = api.state!;
  const [videoUrl, setVideoUrl] = useState(run.videoUrl ?? "");
  const [trickUrl, setTrickUrl] = useState(run.bestTrickVideoUrl ?? "");
  const now = useNow(30_000);
  const deadline = state.event.submissionDeadlineAt;
  const open = state.event.status === "live" && deadline !== null && new Date(deadline).getTime() > now.getTime();
  const locked = run.status !== "scheduled" && run.status !== "submitted";
  const valid = isAllowedVideoUrl(videoUrl) && (!hasBestTrick || isAllowedVideoUrl(trickUrl));

  if (locked) {
    return run.videoUrl ? (
      <p className={`mt-3 ${BODY}`}>
        Your video is locked because judges started scoring it.{" "}
        <a href={run.videoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-on-surface underline">
          Open it
        </a>
      </p>
    ) : null;
  }

  return (
    <div className={`mt-4 ${CARD_NESTED}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <Video size={16} aria-hidden="true" /> {run.videoUrl ? "Your video" : "Submit your video"}
        </p>
        {deadline && open ? (
          <span className={LABEL}>
            Due in <Countdown target={deadline} label="Video deadline in" className="text-on-surface" />
          </span>
        ) : null}
      </div>
      {!open ? (
        <p className={`mt-2 ${BODY}`}>
          {state.event.status === "live" ? "The deadline has passed." : "You can submit once the contest starts. Film your run now."}
        </p>
      ) : (
        <>
          <label className="mt-3 block">
            <span className={LABEL}>Run video link</span>
            <input
              type="url"
              inputMode="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://youtu.be/…"
              className={`mt-1 ${INPUT}`}
            />
          </label>
          {hasBestTrick ? (
            <label className="mt-3 block">
              <span className={LABEL}>Best trick video link</span>
              <input
                type="url"
                inputMode="url"
                value={trickUrl}
                onChange={(event) => setTrickUrl(event.target.value)}
                placeholder="https://youtu.be/…"
                className={`mt-1 ${INPUT}`}
              />
            </label>
          ) : null}
          <p className={`mt-2 ${LABEL}`}>Links from {VIDEO_HOST_LABELS}. Make sure the video is viewable by anyone with the link.</p>
          {api.actionError ? <p role="alert" className={`mt-3 text-sm ${alertClass("error")}`}>{api.actionError}</p> : null}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!valid || api.busy}
              onClick={() =>
                void api.mutate(`/runs/${run.id}/video`, "POST", {
                  videoUrl: videoUrl.trim(),
                  ...(hasBestTrick ? { bestTrickVideoUrl: trickUrl.trim() } : {}),
                })
              }
              className={controlClass("primary")}
            >
              {run.videoUrl ? "Replace video" : "Submit video"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LeaveContest({ api }: { api: ContestStateApi }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {confirming ? (
        <>
          <span className={BODY}>Leave this contest? Your entry is removed.</span>
          <button type="button" onClick={() => setConfirming(false)} className={controlClass("outline")}>
            Stay
          </button>
          <button
            type="button"
            disabled={api.busy}
            onClick={async () => {
              const ok = await api.run((version) =>
                fetch(`/api/league/events/${api.state!.event.id}/leave`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), expectedVersion: version }),
                }),
              );
              if (ok) window.location.assign("/league");
            }}
            className={controlClass("secondary")}
          >
            Leave
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={controlClass("outline")}>
          <LogOut size={14} aria-hidden="true" /> Leave contest
        </button>
      )}
    </div>
  );
}
