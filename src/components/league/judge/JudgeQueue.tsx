"use client";

/**
 * Touch-first judge queue (`/league/[slug]/judge`): current run with
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
  BODY,
  CARD,
  CARD_NESTED,
  CARD_TITLE,
  EYEBROW,
  PAGE_TITLE,
  alertClass,
  controlClass,
  pageContainer,
  tagClass,
} from "@/components/ui/recipes";
import {
  formatCountdown,
  isOrganizerRole,
  isWindowActive,
  pickOpenRun,
} from "@/lib/league/ui-state";
import type { LeagueEventState } from "@/lib/services/league";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";
import { buildContestDetailUrl } from "@/lib/league/urls";

type RunState = LeagueEventState["runs"][number];
type ScoreSummary = RunState["scores"][number];

function myScoreForRun(
  run: RunState,
  myId: string | null,
): ScoreSummary | null {
  if (!myId) return null;
  return run.scores.find((score) => score.judgeUserId === myId) ?? null;
}

export function JudgeQueue({
  eventId,
  slug,
}: {
  eventId: string;
  slug: string;
}) {
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
      try {
        const response = await fetchWithTimeout(
          `/api/league/events/${eventId}`,
          {
            cache: "no-store",
            timeoutMs: DEFAULT_READ_TIMEOUT_MS,
          },
        );
        if (opts.isCancelled?.()) return;
        if (!response.ok) {
          if (!stateRef.current) {
            setError("This contest could not be loaded. Try again shortly.");
          }
          return;
        }
        const data = (await response.json()) as LeagueEventState;
        if (opts.isCancelled?.()) return;
        stateRef.current = data;
        setError(null);
        setState(data);
      } catch (err) {
        if (opts.isCancelled?.()) return;
        if (!stateRef.current) {
          setError("This contest could not be loaded. Try again shortly.");
        }
        throw err;
      }
    },
    [eventId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load({ isCancelled: () => cancelled });
      } catch {
        // Error state already set by load() when stateRef.current is null.
      }
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
        const response = await fetchWithTimeout(
          `/api/league/events/${eventId}${path}`,
          {
            method: "POST",
            timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedVersion: current.event.version,
              idempotencyKey: crypto.randomUUID(),
              ...body,
            }),
          },
        );
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
      <div className={`${pageContainer("3xl")} text-on-surface`}>
        {error ? (
          <div
            role="alert"
            className={`flex flex-col items-start gap-3 text-sm ${alertClass("error")}`}
          >
            {error}
            <button
              type="button"
              onClick={retry}
              className={controlClass("outline", "sm")}
            >
              Retry
            </button>
          </div>
        ) : (
          <div aria-busy="true">
            <p className="sr-only">Loading the judge queue…</p>
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div className="h-16 w-2/3 animate-pulse rounded-card bg-surface-container-high" />
              <div className="h-64 animate-pulse rounded-container border border-outline-variant bg-surface-container-lowest" />
              <div className="h-20 animate-pulse rounded-container border border-outline-variant bg-surface-container-lowest" />
            </div>
          </div>
        )}
      </div>
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
        .filter(
          (entry): entry is { run: RunState; score: ScoreSummary } =>
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
    <div className={`${pageContainer("3xl")} text-on-surface`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>Judge queue</p>
          <h1 className={`mt-1 ${PAGE_TITLE}`}>{event.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <StateBadge status={event.status} />
            <span className={tagClass("outline")} data-realtime={connection}>
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-control",
                  connection === "connected" ? "bg-primary" : "bg-outline",
                )}
              />
              {connection}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(buildContestDetailUrl(slug))}
          className={controlClass("outline")}
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
        <div role="alert" className={`mb-5 text-sm ${alertClass("error")}`}>
          {actionError}
        </div>
      ) : null}

      <section
        aria-labelledby="judge-current-run"
        className={`mb-8 ${CARD} sm:p-6`}
      >
        <h2 id="judge-current-run" className={`mb-4 ${CARD_TITLE}`}>
          Current run
        </h2>
        {event.status !== "live" ? (
          <p className={BODY}>
            Judging opens when the event goes live.
          </p>
        ) : !openRun ? (
          <p className={BODY}>
            No run is being judged right now. The queue updates automatically.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-primary font-display text-base font-bold tabular-nums text-on-primary">
                  {openRun.sequence}
                </span>
                <div className="min-w-0">
                  <p className="min-w-0 truncate text-lg font-semibold text-on-surface">
                    {openRun.riderName}
                  </p>
                  <p className="font-display text-sm font-semibold uppercase tracking-label text-secondary">
                    Run {openRun.sequence} of {state.runs.length}
                  </p>
                </div>
              </div>
              {openRun.windowEndsAt !== null && windowActive ? (
                <p
                  className="shrink-0 font-display text-2xl font-bold tabular-nums text-on-surface"
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
                <span className={`shrink-0 ${tagClass("outline", "lg")}`}>
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
                  onSubmit={(scores) =>
                    submit(openRun.id, scores, openRun.riderName)
                  }
                />
                <p
                  className="text-sm font-semibold text-secondary"
                  aria-live="polite"
                >
                  {openRunMyScore
                    ? `Your current total: ${openRunMyScore.total.toFixed(2)} — revising replaces it.`
                    : `Window open until ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(openRun.windowEndsAt!))} UTC`}
                </p>
              </>
            ) : (
              <p
                className="text-sm font-semibold text-secondary"
                aria-live="polite"
              >
                {readOnly
                  ? "The contest is read-only while payment is pending."
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
                  className={controlClass("outline", "lg")}
                >
                  Extend 5 min
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void run(`/runs/${openRun.id}/window`, { mode: "close" });
                  }}
                  className={controlClass("outline", "lg")}
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
          <h2 id="judge-history-heading" className={EYEBROW}>
            My submissions
          </h2>
          <Gavel size={14} aria-hidden="true" className="text-secondary" />
        </div>
        {mySubmissions.length === 0 ? (
          <p className={BODY}>
            Scores you submit appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mySubmissions.map((entry) => (
              <li
                key={entry.run.id}
                className={`flex items-center justify-between gap-3 ${CARD_NESTED}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-container-high font-display text-xs font-bold tabular-nums text-on-surface">
                    {entry.run.sequence}
                  </span>
                  <p className="min-w-0 truncate text-sm font-medium text-on-surface">
                    {entry.run.riderName}
                  </p>
                </div>
                <span className={`shrink-0 tabular-nums ${tagClass("neutral")}`}>
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
          className={`mt-4 text-sm ${alertClass("neutral")}`}
        >
          {submittedNotice}
        </p>
      ) : null}
    </div>
  );
}
