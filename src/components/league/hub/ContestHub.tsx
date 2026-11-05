"use client";

/**
 * The contest hub for members (below the contest hero on `/league/[slug]`):
 * one "Your next step" card with a single primary action, then role-aware
 * tabs — Overview, Standings, My runs (riders), Judging (judges and
 * organizers) and Run the contest (organizers). `?tab=` deep-links a tab.
 * One shared state fetch + realtime drives every tab.
 */

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, CircleDot, Lock } from "lucide-react";
import { ManageConsole } from "@/components/league/manage/ManageConsole";
import {
  BODY,
  CARD,
  CARD_TITLE,
  EYEBROW,
  LABEL,
  SEGMENTED_TRACK,
  alertClass,
  controlClass,
  segmentClass,
  tagClass,
} from "@/components/ui/recipes";
import { buildNextStepInput } from "@/lib/league/hub-state";
import { HUB_TAB_LABELS, hubTabsFor, nextStepFor, parseHubTab, type HubTab, type NextStep } from "@/lib/league/next-step";
import { roleLabel } from "@/lib/league/ui-state";
import { FormatBrief } from "./FormatBrief";
import { JudgingPanel } from "./JudgingPanel";
import { MyRunsPanel } from "./MyRunsPanel";
import { StandingsBoard } from "./StandingsBoard";
import { useContestState } from "./useContestState";
import { useNow } from "./useNow";

export function ContestHub({ eventId }: { eventId: string }) {
  const api = useContestState(eventId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = api.state;
  const role = state?.myRole ?? null;
  const tab = parseHubTab(searchParams.get("tab"), role);
  const tabs = hubTabsFor(role);

  const now = useNow(30_000);

  const step = useMemo(() => {
    if (!state) return null;
    const input = buildNextStepInput(state, now);
    return input ? nextStepFor(input) : null;
  }, [state, now]);

  const selectTab = (next: HubTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}#hub`, { scroll: false });
  };

  if (api.error) {
    return (
      <div role="alert" className={`flex flex-col items-start gap-3 text-sm ${alertClass("error")}`}>
        {api.error}
        <button type="button" onClick={api.retry} className={controlClass("outline", "sm")}>
          Retry
        </button>
      </div>
    );
  }
  if (!state) {
    return (
      <div aria-busy="true" className="space-y-3">
        <p className="sr-only">Loading your contest dashboard…</p>
        <div aria-hidden="true" className="h-28 animate-pulse rounded-container bg-surface-container-high" />
        <div aria-hidden="true" className="h-11 animate-pulse rounded-control bg-surface-container-high" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={EYEBROW}>Your contest dashboard</h2>
        {role ? <span className={tagClass("neutral")}>{roleLabel(role)}</span> : null}
      </div>

      {step ? <NextStepCard step={step} onAction={selectTab} /> : null}

      {(role === "main_organizer" || role === "organizer") && tab === "run" ? (
        <LifecycleStepper status={state.event.status} published={state.event.resultsPublished} />
      ) : null}

      {api.actionError ? (
        <div role="alert" className={`flex items-start justify-between gap-3 text-sm ${alertClass("error")}`}>
          <span>{api.actionError}</span>
          <button type="button" onClick={api.clearActionError} className={controlClass("outline", "sm")}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div role="tablist" aria-label="Contest dashboard" className={SEGMENTED_TRACK}>
        {tabs.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            id={`hub-tab-${entry}`}
            aria-selected={tab === entry}
            aria-controls={`hub-panel-${entry}`}
            onClick={() => selectTab(entry)}
            className={segmentClass(tab === entry)}
          >
            {HUB_TAB_LABELS[entry]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`hub-panel-${tab}`} aria-labelledby={`hub-tab-${tab}`}>
        {tab === "overview" ? (
          <FormatBrief divisions={state.divisions} submissionMode={state.event.submissionMode} />
        ) : null}
        {tab === "standings" ? (
          <StandingsBoard eventId={eventId} viewerId={state.myUserId} refreshKey={state.event.version} />
        ) : null}
        {tab === "my-runs" ? <MyRunsPanel api={api} /> : null}
        {tab === "judging" ? <JudgingPanel api={api} /> : null}
        {tab === "run" ? <ManageConsole api={api} /> : null}
      </div>
    </div>
  );
}

const STEP_ICON = {
  action: ArrowRight,
  waiting: CircleDot,
  done: CheckCircle2,
  blocked: Lock,
} as const;

function NextStepCard({ step, onAction }: { step: NextStep; onAction: (tab: HubTab) => void }) {
  const Icon = STEP_ICON[step.tone];
  return (
    <section aria-labelledby="next-step-title" className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
      <div className="flex min-w-0 gap-3">
        <Icon size={20} aria-hidden="true" className={`mt-0.5 shrink-0 ${step.tone === "action" ? "text-primary" : "text-secondary"}`} />
        <div className="min-w-0">
          <p className={LABEL}>Your next step</p>
          <h3 id="next-step-title" className={`mt-0.5 ${CARD_TITLE}`}>
            {step.title}
          </h3>
          <p className={`mt-1 ${BODY}`}>{step.body}</p>
        </div>
      </div>
      {step.action ? (
        <button
          type="button"
          onClick={() => onAction(step.action!.tab)}
          className={controlClass(step.tone === "action" || step.tone === "blocked" ? "primary" : "outline")}
        >
          {step.action.label}
        </button>
      ) : null}
    </section>
  );
}

const LIFECYCLE: { id: string; label: string; statuses: string[] }[] = [
  { id: "setup", label: "Set up", statuses: ["draft"] },
  { id: "invite", label: "Invite riders", statuses: ["registration_open"] },
  { id: "prepare", label: "Prepare runs", statuses: ["registration_closed"] },
  { id: "start", label: "Start", statuses: ["scheduled"] },
  { id: "judge", label: "Judge", statuses: ["live"] },
  { id: "publish", label: "Publish", statuses: ["completed"] },
];

/** Where the contest is in its lifecycle (SetupProgress pattern). */
export function LifecycleStepper({ status, published }: { status: string; published: boolean }) {
  if (status === "cancelled") return null;
  const current = published ? LIFECYCLE.length : LIFECYCLE.findIndex((step) => step.statuses.includes(status));
  return (
    <ol aria-label="Contest progress" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {LIFECYCLE.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const Icon = done ? CheckCircle2 : active ? CircleDot : Circle;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-card border px-3 py-2 text-xs font-semibold ${active ? "border-primary text-on-surface" : "border-outline-variant text-secondary"}`}
          >
            <Icon size={14} aria-hidden="true" className={done || active ? "text-primary" : ""} />
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
