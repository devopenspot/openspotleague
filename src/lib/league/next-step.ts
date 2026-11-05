/**
 * "Your next step" for the contest hub: one card, one primary action, per
 * role and contest state. Pure and deterministic (tested), in the style of
 * `ui-state.ts`. The hub renders it; it never fetches.
 */
import type { EventLifecycleStatus, EventRole } from "@/types/league";

export type HubTab = "overview" | "standings" | "my-runs" | "judging" | "run";

export type SubmissionMode = "live" | "video";

export interface NextStepRun {
  runId: string;
  divisionLabel: string;
  /** scheduled | submitted | judging | scored | skipped */
  status: string;
  hasVideo: boolean;
  scheduledAt: string | null;
  windowEndsAt: string | null;
}

export interface NextStepInput {
  role: EventRole;
  status: EventLifecycleStatus;
  submissionMode: SubmissionMode;
  now: Date;
  startAt: string;
  submissionDeadlineAt: string | null;
  resultsPublished: boolean;
  /** Payment gate blocks writes (`locked` or `disabled`). */
  writesBlocked: boolean;
  riders: { joined: number; cap: number | null };
  runs: { total: number; scoredOrSkipped: number; awaitingScore: number };
  /** Rider's own runs (rider role only). */
  myRuns: readonly NextStepRun[];
  /** Runs this judge still has to score (judge or organizer). */
  myPendingScores: number;
  /** The run whose live window is open now, if any. */
  openRun: { runId: string; isMine: boolean } | null;
  /** Rider has entered at least one division. */
  hasEntries: boolean;
}

export interface NextStep {
  id: string;
  title: string;
  body: string;
  action: { label: string; tab: HubTab } | null;
  tone: "action" | "waiting" | "done" | "blocked";
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** "in 2 days", "in 5 hours", "in under an hour", "now". */
export function relativeDue(target: string | null, now: Date): string {
  if (!target) return "";
  const diff = new Date(target).getTime() - now.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return "now";
  if (diff >= DAY_MS) {
    const days = Math.round(diff / DAY_MS);
    return `in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (diff >= HOUR_MS) {
    const hours = Math.round(diff / HOUR_MS);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return "in under an hour";
}

function deadlinePassed(input: NextStepInput): boolean {
  if (!input.submissionDeadlineAt) return false;
  return new Date(input.submissionDeadlineAt).getTime() <= input.now.getTime();
}

function organizerStep(input: NextStepInput): NextStep {
  const { status, riders, runs } = input;
  const run = (label: string) => ({ label, tab: "run" as const });
  switch (status) {
    case "draft":
      return {
        id: "org-open-registration",
        title: "Open registration",
        body: "Check the details and divisions, then open registration so riders can join.",
        action: run("Open registration"),
        tone: "action",
      };
    case "registration_open": {
      const capText = riders.cap === null ? `${riders.joined}` : `${riders.joined} of ${riders.cap}`;
      if (riders.joined === 0) {
        return {
          id: "org-invite",
          title: "Invite riders",
          body: "Share the rider invite link or QR code. Riders pick their divisions when they join.",
          action: run("Share invite"),
          tone: "action",
        };
      }
      return {
        id: "org-close-registration",
        title: `${capText} riders joined`,
        body: "Keep sharing the invite, or close registration when everyone is in.",
        action: run("Close registration"),
        tone: "action",
      };
    }
    case "registration_closed":
      return {
        id: "org-prepare-runs",
        title: input.submissionMode === "video" ? "Prepare the runs" : "Generate the start order",
        body:
          input.submissionMode === "video"
            ? "This creates one run per rider and division, so riders can submit their videos."
            : "This creates the start order for every division, with a time slot per run.",
        action: run(input.submissionMode === "video" ? "Prepare runs" : "Generate schedule"),
        tone: "action",
      };
    case "scheduled":
      return {
        id: "org-start",
        title: "Start the contest",
        body:
          input.submissionMode === "video"
            ? "Starting opens video submissions and judging."
            : `Start when the first rider is ready (planned ${relativeDue(input.startAt, input.now)}).`,
        action: run("Start contest"),
        tone: "action",
      };
    case "live": {
      if (input.submissionMode === "live" && !input.openRun && runs.scoredOrSkipped < runs.total) {
        return {
          id: "org-open-window",
          title: "Open the next run",
          body: `${runs.scoredOrSkipped} of ${runs.total} runs done. Open the next rider's judging window.`,
          action: { label: "Open next run", tab: "judging" },
          tone: "action",
        };
      }
      if (input.myPendingScores > 0) {
        return {
          id: "org-score",
          title: `${input.myPendingScores} run${input.myPendingScores === 1 ? "" : "s"} waiting for your score`,
          body: "Score each run on the five criteria and tick the elements you saw.",
          action: { label: "Go to judging", tab: "judging" },
          tone: "action",
        };
      }
      if (runs.total > 0 && runs.scoredOrSkipped >= runs.total) {
        return {
          id: "org-complete",
          title: "Every run is judged",
          body: "Complete the contest to freeze scores, then publish the results.",
          action: run("Complete contest"),
          tone: "action",
        };
      }
      return {
        id: "org-live-waiting",
        title: "Judging in progress",
        body:
          input.submissionMode === "video"
            ? `Videos are due ${relativeDue(input.submissionDeadlineAt, input.now)}. ${runs.awaitingScore} waiting for judges.`
            : `${runs.scoredOrSkipped} of ${runs.total} runs done.`,
        action: { label: "View standings", tab: "standings" },
        tone: "waiting",
      };
    }
    case "completed":
      return input.resultsPublished
        ? {
            id: "org-published",
            title: "Results are published",
            body: "Riders got their points. Share the standings.",
            action: { label: "View standings", tab: "standings" },
            tone: "done",
          }
        : {
            id: "org-publish",
            title: "Publish the results",
            body: "Publishing freezes the standings and awards league points.",
            action: run("Publish results"),
            tone: "action",
          };
    case "cancelled":
      return { id: "cancelled", title: "Contest cancelled", body: "Nothing else to do here.", action: null, tone: "done" };
  }
}

function judgeStep(input: NextStepInput): NextStep {
  if (input.status === "live") {
    if (input.myPendingScores > 0) {
      return {
        id: "judge-score",
        title: `${input.myPendingScores} run${input.myPendingScores === 1 ? "" : "s"} waiting for your score`,
        body: "Score the five criteria from 0 to 10 and tick the required elements you saw.",
        action: { label: "Start judging", tab: "judging" },
        tone: "action",
      };
    }
    return {
      id: "judge-waiting",
      title: "You're up to date",
      body:
        input.submissionMode === "video"
          ? "New runs appear in your queue as riders submit videos."
          : "The next run appears when the organizer opens its window.",
      action: { label: "Open judging", tab: "judging" },
      tone: "waiting",
    };
  }
  if (input.status === "completed") {
    return {
      id: "judge-done",
      title: input.resultsPublished ? "Results are published" : "Judging is closed",
      body: input.resultsPublished ? "Thanks for judging." : "The organizer will publish the results.",
      action: { label: "View standings", tab: "standings" },
      tone: "done",
    };
  }
  if (input.status === "cancelled") {
    return { id: "cancelled", title: "Contest cancelled", body: "Nothing else to do here.", action: null, tone: "done" };
  }
  return {
    id: "judge-prepare",
    title: "Get ready to judge",
    body: "Read the criteria and required elements for each division before the contest starts.",
    action: { label: "Read the format", tab: "overview" },
    tone: "waiting",
  };
}

function riderStep(input: NextStepInput): NextStep {
  const myRuns = { label: "Go to my runs", tab: "my-runs" as const };
  if (input.status === "cancelled") {
    return { id: "cancelled", title: "Contest cancelled", body: "This contest won't run.", action: null, tone: "done" };
  }
  if (!input.hasEntries && (input.status === "draft" || input.status === "registration_open")) {
    return {
      id: "rider-enter",
      title: "Pick your divisions",
      body: "Choose the divisions you'll ride and your category.",
      action: { label: "Edit my entry", tab: "my-runs" },
      tone: "action",
    };
  }
  if (input.status === "draft" || input.status === "registration_open" || input.status === "registration_closed") {
    return {
      id: "rider-registered",
      title: "You're in",
      body: "Read the format and required elements so your run shows all of them.",
      action: { label: "Read the format", tab: "overview" },
      tone: "waiting",
    };
  }
  if (input.status === "scheduled" || input.status === "live") {
    if (input.submissionMode === "video") {
      const missing = input.myRuns.filter((run) => !run.hasVideo && run.status !== "skipped");
      if (missing.length > 0 && input.status === "live" && !deadlinePassed(input)) {
        const first = missing[0]!;
        return {
          id: "rider-submit-video",
          title: `Submit your ${first.divisionLabel} video`,
          body: `Due ${relativeDue(input.submissionDeadlineAt, input.now)}. Paste a YouTube, Instagram, Vimeo or Drive link.`,
          action: myRuns,
          tone: "action",
        };
      }
      if (missing.length > 0 && input.status === "scheduled") {
        return {
          id: "rider-video-soon",
          title: "Submissions open when the contest starts",
          body: "Film your run now. Check the required elements before you record.",
          action: myRuns,
          tone: "waiting",
        };
      }
    } else if (input.openRun?.isMine) {
      return {
        id: "rider-up-now",
        title: "You're up",
        body: "Your judging window is open. Ride your run now.",
        action: myRuns,
        tone: "action",
      };
    }
    const next = input.myRuns.find((run) => run.status === "scheduled" && run.scheduledAt);
    if (input.submissionMode === "live" && next) {
      return {
        id: "rider-next-run",
        title: `${next.divisionLabel} run ${relativeDue(next.scheduledAt, input.now)}`,
        body: "Be at the start a few minutes before your slot.",
        action: myRuns,
        tone: "waiting",
      };
    }
    return {
      id: "rider-waiting-scores",
      title: "Your runs are in",
      body: "Judges are scoring. Provisional standings update live.",
      action: { label: "View standings", tab: "standings" },
      tone: "waiting",
    };
  }
  return input.resultsPublished
    ? {
        id: "rider-share",
        title: "Your results are out",
        body: "See your rank and points, then share your result card.",
        action: myRuns,
        tone: "done",
      }
    : {
        id: "rider-awaiting-publish",
        title: "Waiting for results",
        body: "The organizer will publish the final standings soon.",
        action: { label: "View standings", tab: "standings" },
        tone: "waiting",
      };
}

export function nextStepFor(input: NextStepInput): NextStep {
  if (input.writesBlocked && (input.role === "main_organizer" || input.role === "organizer")) {
    return {
      id: "org-payment",
      title: "Payment needed",
      body: "This contest is locked until its plan payment is registered.",
      action: { label: "Review plan", tab: "run" },
      tone: "blocked",
    };
  }
  if (input.role === "main_organizer" || input.role === "organizer") return organizerStep(input);
  if (input.role === "judge") return judgeStep(input);
  return riderStep(input);
}

/** Tabs a role can open, in display order. */
export function hubTabsFor(role: EventRole | null): HubTab[] {
  if (role === "main_organizer" || role === "organizer") {
    return ["overview", "standings", "judging", "run"];
  }
  if (role === "judge") return ["overview", "standings", "judging"];
  if (role === "rider") return ["overview", "standings", "my-runs"];
  return ["overview", "standings"];
}

export const HUB_TAB_LABELS: Readonly<Record<HubTab, string>> = {
  overview: "Overview",
  standings: "Standings",
  "my-runs": "My runs",
  judging: "Judging",
  run: "Run the contest",
};

export function parseHubTab(raw: string | null | undefined, role: EventRole | null): HubTab {
  const tabs = hubTabsFor(role);
  return tabs.find((tab) => tab === raw) ?? "overview";
}
