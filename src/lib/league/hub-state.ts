/**
 * Pure projections the contest hub derives from `LeagueEventState`: the
 * next-step input, the judge queue, the rider's runs and readable run
 * statuses. No React; unit-tested.
 */
import type { NextStepInput, NextStepRun } from "./next-step";
import type { EventLifecycleStatus, EventRole } from "@/types/league";

/** The slice of `LeagueEventState` these helpers read (keeps tests light). */
export interface HubStateLike {
  event: {
    status: string;
    submissionMode: "live" | "video";
    submissionDeadlineAt: string | null;
    startAt: string;
    resultsPublished: boolean;
  };
  myRole: EventRole | null;
  myUserId: string;
  readOnly: boolean;
  counts: { riders: number };
  plan: { maxRiders: number | null };
  divisions: { id: string; label: string; hasBestTrick: boolean }[];
  myEntry: { divisionIds: string[] } | null;
  runs: {
    id: string;
    divisionId: string;
    sequence: number;
    riderUserId: string;
    status: string;
    scheduledAt: string | null;
    windowEndsAt: string | null;
    videoUrl: string | null;
    scores: { judgeUserId: string }[];
  }[];
}

const RUN_STATUS_LABELS: Record<string, string> = {
  scheduled: "Waiting",
  submitted: "Video in",
  judging: "Judging now",
  scored: "Scored",
  skipped: "Skipped",
  completed: "Done",
};

export function runStatusLabel(status: string, mode: "live" | "video"): string {
  if (status === "scheduled") return mode === "video" ? "Video missing" : "Waiting";
  return RUN_STATUS_LABELS[status] ?? status;
}

export function divisionLabelFor(state: HubStateLike, divisionId: string): string {
  return state.divisions.find((division) => division.id === divisionId)?.label ?? "Division";
}

function windowOpen(run: HubStateLike["runs"][number], now: Date): boolean {
  return run.status === "judging" && run.windowEndsAt !== null && new Date(run.windowEndsAt).getTime() > now.getTime();
}

/** Runs this viewer can score right now and hasn't scored yet. */
export function runsAwaitingMyScore<S extends HubStateLike>(state: S, now: Date): S["runs"] {
  if (state.event.status !== "live") return [];
  return (state.runs as S["runs"]).filter((run: HubStateLike["runs"][number]) => {
    const mine = run.scores.some((score) => score.judgeUserId === state.myUserId);
    if (mine) return false;
    if (state.event.submissionMode === "video") {
      return (run.status === "submitted" || run.status === "scored") && Boolean(run.videoUrl);
    }
    return windowOpen(run, now);
  });
}

/** The live run with an open window, if any. */
export function openLiveRun<S extends HubStateLike>(state: S, now: Date): S["runs"][number] | null {
  if (state.event.submissionMode !== "live") return null;
  return (state.runs as S["runs"]).find((run: HubStateLike["runs"][number]) => windowOpen(run, now)) ?? null;
}

export function myRuns<S extends HubStateLike>(state: S): S["runs"] {
  return (state.runs as S["runs"]).filter((run: HubStateLike["runs"][number]) => run.riderUserId === state.myUserId);
}

export function buildNextStepInput(state: HubStateLike, now: Date): NextStepInput | null {
  if (!state.myRole) return null;
  const done = state.runs.filter((run) => run.status === "scored" || run.status === "skipped").length;
  const open = openLiveRun(state, now);
  const mine: NextStepRun[] = myRuns(state).map((run) => ({
    runId: run.id,
    divisionLabel: divisionLabelFor(state, run.divisionId),
    status: run.status,
    hasVideo: Boolean(run.videoUrl),
    scheduledAt: run.scheduledAt,
    windowEndsAt: run.windowEndsAt,
  }));
  return {
    role: state.myRole,
    status: state.event.status as EventLifecycleStatus,
    submissionMode: state.event.submissionMode,
    now,
    startAt: state.event.startAt,
    submissionDeadlineAt: state.event.submissionDeadlineAt,
    resultsPublished: state.event.resultsPublished,
    writesBlocked: state.readOnly,
    riders: { joined: state.counts.riders, cap: state.plan.maxRiders },
    runs: {
      total: state.runs.length,
      scoredOrSkipped: done,
      awaitingScore: state.runs.filter((run) => run.status === "submitted").length,
    },
    myRuns: mine,
    myPendingScores: runsAwaitingMyScore(state, now).length,
    openRun: open ? { runId: open.id, isMine: open.riderUserId === state.myUserId } : null,
    hasEntries: (state.myEntry?.divisionIds.length ?? 0) > 0 || mine.length > 0,
  };
}
