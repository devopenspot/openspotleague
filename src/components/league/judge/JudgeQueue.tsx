"use client";

/**
 * Touch-first judge queue (`/sport-events/[slug]/judge`): current run with
 * window countdown, one stepper per criterion (shared RunScoreForm), submit +
 * revise, past submissions list. Same state-driven, realtime-refreshed model
 * as the organizer console.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUser } from "@/lib/contexts/user-context";
import { PaymentGateNotice } from "@/components/league/PaymentGateNotice";
import { RunScoreForm } from "@/components/league/RunScoreForm";
import { useLeagueRealtime } from "@/components/league/hooks/useLeagueRealtime";
import { StateBadge } from "@/components/league/manage/manage-parts";
import {
  formatCountdown,
  isOrganizerRole,
  isWindowActive,
  pickOpenRun,
} from "@/lib/league/ui-state";
import type { LeagueEventState } from "@/lib/services/league";

type RunState = LeagueEventState["runs"][number];
type ScoreSummary = RunState["scores"][number];

function myScoreForRun(run: RunState, myId: string | null): ScoreSummary | null {
  if (!myId) return null;
  return run.scores.find((score) => score.judgeUserId === myId) ?? null;
}

export function JudgeQueue({ eventId, slug }: { eventId: string; slug: string }) {
  const router = useRouter();
  const user = useUser();
  const myId = user?.id ?? null;
  const [state, setState] = useState<LeagueEventState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const stateRef = useRef<LeagueEventState | null>(null);

  const load = useCallback(
    async (opts: { isCancelled?: () => boolean } = {}) => {
      const response = await fetch(`/api/league/events/${eventId}`, {
        cache: "no-store",
      });
      if (opts.isCancelled?.()) return;
      if (!response.ok) {
        setError("This event could not be loaded. Try again shortly.");
        return;
      }
      const data = (await response.json()) as LeagueEventState;
      if (opts.isCancelled?.()) return;
      stateRef.current = data;
      setState(data);
    },
    [eventId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load({ isCancelled: () => cancelled });
    })();
    return () => {
      cancelled = true;
    };
  }, [load, reloadTick]);

  const retry = useCallback(() => {
    setError(null);
    setReloadTick((tick) => tick + 1);
  }, []);

  const connection = useLeagueRealtime(eventId, load);

  useEffect(() => {
    if (state?.event.status !== "live") return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.event.status]);

  const run = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<boolean> => {
      const current = stateRef.current;
      if (!current) return false;
      setBusy(true);
      setActionError(null);
      try {
        const response = await fetch(`/api/league/events/${eventId}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: current.event.version,
            idempotencyKey: crypto.randomUUID(),
            ...body,
          }),
        });
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(raw?.message ?? raw?.error ?? "Action failed.");
          return false;
        }
        await load();
        return true;
      } catch {
        setActionError("Action failed. Check your connection and try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [eventId, load],
  );

  if (error || !state) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-12">
        {error ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
          >
            {error}
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 items-center rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface transition-colors hover:border-outline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-lg bg-surface-container"
              />
            ))}
          </div>
        )}
      </main>
    );
  }

  const event = state.event;
  const organizer = isOrganizerRole(state.myRole);
  const readOnly = state.readOnly;

  const judgingRuns = state.runs.filter((entry) => entry.status === "judging");
  const openRun = pickOpenRun(judgingRuns, nowMs);
  const windowActive = openRun ? isWindowActive(openRun, nowMs) : false;
  const openRunMyScore = openRun ? myScoreForRun(openRun, myId) : null;
  const mySubmissions = myId
    ? state.runs
        .map((entry) => ({ run: entry, score: myScoreForRun(entry, myId) }))
        .filter((entry): entry is { run: RunState; score: ScoreSummary } =>
          entry.score !== null,
        )
    : [];

  async function submit(
    runId: string,
    scores: Record<string, number>,
    riderName: string,
  ): Promise<boolean> {
    const ok = await run(`/runs/${runId}/scores`, { scores });
    setSubmittedNotice(ok ? `Score submitted for ${riderName}.` : null);
    return ok;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
            Judge queue
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-on-surface">
            {event.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
            <StateBadge status={event.status} />
            <span
              className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5"
              data-realtime={connection}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connection === "connected" ? "bg-primary" : "bg-outline",
                )}
              />
              {connection}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/sport-events/${slug}`)}
          className="min-h-11 rounded-full border border-outline-variant px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-secondary transition-colors hover:border-outline hover:text-on-surface"
        >
          Event page
        </button>
      </div>

      {state.notice ? (
        <div className="mb-5">
          <PaymentGateNotice
            state={
              state.payment.state === "pending"
                ? "pending"
                : state.payment.state === "locked"
                  ? "locked"
                  : "disabled"
            }
            title={state.notice.title}
            message={state.notice.message}
            paymentDueAt={state.payment.paymentDueAt}
            paymentDeadlineAt={state.payment.paymentDeadlineAt}
          />
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {actionError}
        </div>
      ) : null}

      <section
        aria-labelledby="judge-current-run"
        className="mb-8 rounded-inner border border-outline-variant bg-surface-bright p-4"
      >
        <h2
          id="judge-current-run"
          className="mb-3 font-display text-sm font-bold uppercase tracking-[0.05em]"
        >
          Current run
        </h2>
        {event.status !== "live" ? (
          <p className="text-sm text-secondary">
            Judging opens when the event goes live.
          </p>
        ) : !openRun ? (
          <p className="text-sm text-secondary">
            No run is being judged right now. The queue updates automatically.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-display text-xs font-bold text-on-surface">
                  {openRun.sequence}
                </span>
                <div className="min-w-0">
                  <p className="min-w-0 truncate text-base font-semibold text-on-surface">
                    {openRun.riderName}
                  </p>
                  <p className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
                    Run {openRun.sequence} of {state.runs.length}
                  </p>
                </div>
              </div>
              {openRun.windowEndsAt !== null && windowActive ? (
                <p
                  className="shrink-0 font-mono text-xl font-bold tabular-nums text-on-surface"
                  aria-live="polite"
                  aria-label="Time left in the judging window"
                >
                  {nowMs === null
                    ? ""
                    : formatCountdown(
                        new Date(openRun.windowEndsAt).getTime() - nowMs,
                      )}
                </p>
              ) : (
                <span className="shrink-0 rounded-md border border-outline-variant px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
                  Window closed
                </span>
              )}
            </div>

            {windowActive && !readOnly ? (
              <>
                <RunScoreForm
                  key={openRun.id}
                  criteria={state.criteria}
                  initialScores={openRunMyScore?.criteria}
                  submitLabel={openRunMyScore ? "Revise score" : "Submit score"}
                  disabled={busy}
                  onSubmit={(scores) => submit(openRun.id, scores, openRun.riderName)}
                />
                <p
                  className="font-display text-[10px] font-bold uppercase tracking-[0.08em] text-secondary"
                  aria-live="polite"
                >
                  {openRunMyScore
                    ? `Your current total: ${openRunMyScore.total.toFixed(2)} — revising replaces it.`
                    : `Window open until ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(openRun.windowEndsAt!))} UTC`}
                </p>
              </>
            ) : (
              <p
                className="font-display text-[10px] font-bold uppercase tracking-[0.08em] text-secondary"
                aria-live="polite"
              >
                {readOnly
                  ? "The event is read-only while payment is pending."
                  : "Window closed — the organizer can extend it to allow scoring."}
              </p>
            )}

            {organizer && !readOnly ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void run(`/runs/${openRun.id}/window`, {
                      mode: "extend",
                      windowMinutes: 5,
                    });
                  }}
                  className="min-h-11 rounded-full border border-outline-variant px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface hover:border-outline disabled:opacity-40"
                >
                  Extend 5 min
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void run(`/runs/${openRun.id}/window`, { mode: "close" });
                  }}
                  className="min-h-11 rounded-full border border-outline-variant px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface hover:border-outline disabled:opacity-40"
                >
                  Close window
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="judge-history-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="judge-history-heading"
            className="font-display text-sm font-bold uppercase tracking-[0.05em]"
          >
            My submissions
          </h2>
          <Gavel size={14} aria-hidden="true" className="text-secondary" />
        </div>
        {mySubmissions.length === 0 ? (
          <p className="text-sm text-secondary">Scores you submit appear here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mySubmissions.map((entry) => (
              <li
                key={entry.run.id}
                className="flex items-center justify-between gap-3 rounded-inner border border-outline-variant bg-surface-bright px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-display text-xs font-bold text-on-surface">
                    {entry.run.sequence}
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium text-on-surface">
                    {entry.run.riderName}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-surface-container px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface">
                  {entry.score.total.toFixed(2)} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {submittedNotice ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-on-surface"
        >
          {submittedNotice}
        </p>
      ) : null}
    </main>
  );
}
