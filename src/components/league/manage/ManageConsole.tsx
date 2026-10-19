"use client";

/**
 * Organizer console for a league event (`/sport-events/[slug]/manage`).
 * One GET state payload (version-gated ETag) drives every tab; mutations
 * carry `expectedVersion` + a UUID idempotency key and refresh the state.
 * Polls every 5 s while the event is live (dedicated realtime channel
 * wiring lands with Phase 3d).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardList, Crown, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PaymentGateNotice } from "@/components/league/PaymentGateNotice";
import { useLeagueRealtime } from "@/components/league/hooks/useLeagueRealtime";
import {
  ConfirmButton,
  InviteRow,
  MemberRow,
  RunRow,
  StateBadge,
  MANAGE_CONTROL_CLASSES,
} from "./manage-parts";
import { isOrganizerRole } from "@/lib/league/ui-state";
import type { LeagueDashboard, LeagueEventState } from "@/lib/services/league";

type Tab = "config" | "roster" | "live" | "results" | "metrics";

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "config", label: "Event", icon: Settings },
  { id: "roster", label: "People", icon: Users },
  { id: "live", label: "Runs", icon: ClipboardList },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
  { id: "results", label: "Results", icon: Crown },
];

/** Judges see the run queue + results; riders see them read-only. */
function visibleTabs(
  organizer: boolean,
): { id: Tab; label: string; icon: typeof Settings }[] {
  if (organizer) return TABS;
  return TABS.filter(
    (entry) =>
      entry.id !== "config" && entry.id !== "roster" && entry.id !== "metrics",
  );
}

export function ManageConsole({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LeagueEventState | null>(null);
  const [members, setMembers] = useState<
    {
      membershipId: string;
      userId: string;
      displayName: string;
      role: string;
    }[]
  >([]);
  const [tab, setTab] = useState<Tab>("config");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteRole, setInviteRole] = useState<"organizer" | "judge" | "rider">(
    "rider",
  );
  const [inviteExpiry, setInviteExpiry] = useState("7");
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

  // Realtime refetch via the league event signal channel (polling fallback
  // inside the subscription) — replaces a plain interval.
  const connection = useLeagueRealtime(eventId, load);

  const run = useCallback(
    async (
      action: (version: number) => Promise<Response>,
      options?: { onDone?: () => Promise<void> | void },
    ): Promise<boolean> => {
      const current = stateRef.current;
      if (!current) return false;
      setBusy(true);
      setActionError(null);
      try {
        const response = await action(current.event.version);
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(raw?.message ?? raw?.error ?? "Action failed.");
          return false;
        }
        await load();
        await options?.onDone?.();
        return true;
      } catch {
        setActionError("Action failed. Check your connection and try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const lifecycleAction = useCallback(
    (
      path: string,
      method: "POST" | "PATCH" | "DELETE" = "POST",
      body?: unknown,
    ) =>
      run(async (version) =>
        fetch(`/api/league/events/${eventId}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
            ...((body as Record<string, unknown>) ?? {}),
          }),
        }),
      ),
    [eventId, run],
  );

  const loadMembers = useCallback(async () => {
    const response = await fetch(`/api/league/events/${eventId}/members`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { items: typeof members };
    setMembers(data.items);
  }, [eventId]);

  useEffect(() => {
    if (!isOrganizerRole(state?.myRole ?? null)) return;
    void (async () => {
      await loadMembers();
    })();
  }, [state?.myRole, loadMembers]);

  const refreshMembers = useCallback(async () => {
    await load();
    await loadMembers();
  }, [load, loadMembers]);

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
                className="h-20  rounded-lg bg-surface-container"
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
  const judgeCapable = state.myRole === "judge" || organizer;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
            Organizer console
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-on-surface">
            {event.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
            <StateBadge status={event.status} />
            <span>
              {event.city}, {event.country}
            </span>
            <span aria-hidden="true">·</span>
            <span>Plan: {event.planSlug}</span>
            <span aria-hidden="true">·</span>
            <span>v{event.version}</span>
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
          onClick={() => router.push(`/sport-events/${event.slug}`)}
          className="min-h-11 rounded-full border border-outline-variant px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-secondary transition-colors hover:border-outline hover:text-on-surface"
        >
          View public page
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
            action={
              <PlanPaymentActions
                eventId={eventId}
                version={event.version}
                disabled={busy || state.payment.state === "disabled"}
                onError={(message) => setActionError(message)}
                onDone={() => void load()}
              />
            }
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

      <div
        role="tablist"
        aria-label="Manage sections"
        className="mb-5 flex gap-2 overflow-x-auto"
      >
        {visibleTabs(organizer).map((entry) => (
          <button
            key={entry.id}
            role="tab"
            type="button"
            id={`manage-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`manage-panel-${entry.id}`}
            data-nav-tab
            onClick={() => setTab(entry.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] transition-colors",
              tab === entry.id
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant bg-surface-container-high text-secondary hover:border-outline hover:text-on-surface",
            )}
          >
            <entry.icon size={14} aria-hidden="true" />
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "config" ? (
        <ConfigPanel
          state={state}
          disabled={readOnly || busy}
          lifecycleAction={lifecycleAction}
        />
      ) : null}
      {tab === "roster" ? (
        <RosterPanel
          state={state}
          members={members}
          organizer={organizer}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviteExpiry={inviteExpiry}
          setInviteExpiry={setInviteExpiry}
          disabled={readOnly || busy}
          onRegisterInvite={async (role, expiresInDays) => {
            await lifecycleAction("/invites", "POST", {
              role,
              expiresInDays:
                role === "rider" && inviteExpiry === "0"
                  ? undefined
                  : expiresInDays,
            });
            await refreshMembers();
          }}
          onRevokeInvite={async (inviteId) => {
            await lifecycleAction(`/invites/${inviteId}`, "DELETE");
            await refreshMembers();
          }}
          onRemoveMember={async (membershipId) => {
            await lifecycleAction(`/members/${membershipId}`, "DELETE");
            await refreshMembers();
          }}
        />
      ) : null}
      {tab === "live" ? (
        <LivePanel
          state={state}
          canJudge={judgeCapable}
          disabled={readOnly || busy}
          lifecycleAction={lifecycleAction}
          onSubmitScore={async (runId, scores) => {
            const ok = await run(async (version) =>
              fetch(`/api/league/events/${eventId}/runs/${runId}/scores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expectedVersion: version,
                  idempotencyKey: crypto.randomUUID(),
                  scores,
                }),
              }),
            );
            return ok;
          }}
        />
      ) : null}
      {tab === "results" ? (
        <ResultsPanel
          state={state}
          disabled={readOnly || busy}
          lifecycleAction={lifecycleAction}
        />
      ) : null}
      {tab === "metrics" ? <MetricsPanel eventId={eventId} /> : null}
    </main>
  );
}

function ConfigPanel({
  state,
  lifecycleAction,
  disabled,
}: {
  state: LeagueEventState;
  lifecycleAction: (
    path: string,
    method?: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) => Promise<unknown>;
  disabled: boolean;
}) {
  const event = state.event;
  const [form, setForm] = useState({
    name: event.name,
    shortName: event.shortName ?? "",
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate ?? "",
    timezone: event.timezone,
    city: event.city,
    venue: event.venue ?? "",
    category: event.category,
    visibility: event.visibility,
  });
  const canEdit = !disabled && isOrganizerRole(state.myRole);

  return (
    <section
      id="manage-panel-config"
      aria-labelledby="manage-tab-config"
      className="flex flex-col gap-5"
    >
      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <legend className="px-1 font-display text-sm font-bold tracking-[0.05em] text-on-surface">
          Event details
        </legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="cfg-name"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Name
            </label>
            <input
              id="cfg-name"
              value={form.name}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={MANAGE_CONTROL_CLASSES}
            />
          </div>
          <div>
            <label
              htmlFor="cfg-start"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Start date
            </label>
            <input
              id="cfg-start"
              type="date"
              value={form.startDate}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className={MANAGE_CONTROL_CLASSES}
            />
          </div>
          <div>
            <label
              htmlFor="cfg-end"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              End date
            </label>
            <input
              id="cfg-end"
              type="date"
              value={form.endDate}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className={MANAGE_CONTROL_CLASSES}
            />
          </div>
          <div>
            <label
              htmlFor="cfg-category"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Category
            </label>
            <select
              id="cfg-category"
              value={form.category}
              disabled={!canEdit}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target
                    .value as LeagueEventState["event"]["category"],
                })
              }
              className={MANAGE_CONTROL_CLASSES}
            >
              {[
                "local-event",
                "festival",
                "championship",
                "federation",
                "world-tour",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="cfg-visibility"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Visibility
            </label>
            <select
              id="cfg-visibility"
              value={form.visibility}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              className={MANAGE_CONTROL_CLASSES}
            >
              <option value="unlisted">Unlisted (share link)</option>
              <option value="public">Public directory</option>
            </select>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <ConfirmButton
          label="Save changes"
          confirmTitle="Save event details?"
          confirmBody="Applies every edited field at once."
          disabled={!canEdit}
          variant="primary"
          onConfirm={() =>
            void lifecycleAction("", "PATCH", {
              patch: {
                name: form.name || undefined,
                shortName: form.shortName || undefined,
                description: form.description,
                startDate: form.startDate,
                endDate: form.endDate || null,
                timezone: form.timezone,
                city: form.city,
                venue: form.venue || undefined,
                category: form.category,
                visibility: form.visibility,
              },
            })
          }
        />
        {event.status === "draft" ? (
          <ConfirmButton
            label="Open registration"
            confirmTitle="Open registration?"
            confirmBody="Riders, judges and organizers can join with the share links."
            disabled={disabled}
            onConfirm={() => void lifecycleAction("/registration/open")}
          />
        ) : null}
        {event.status === "registration_open" ? (
          <ConfirmButton
            label="Close registration"
            confirmTitle="Close registration?"
            confirmBody="No more joins via invite links. You can still add members by user id via the API."
            disabled={disabled}
            onConfirm={() => void lifecycleAction("/registration/close")}
          />
        ) : null}
        {event.status === "registration_closed" ? (
          <ConfirmButton
            label="Generate schedule"
            confirmTitle="Generate the run schedule?"
            confirmBody="Creates one judging slot per active rider, ordered by join time, 10 minutes apart."
            disabled={disabled}
            variant="primary"
            onConfirm={() =>
              void lifecycleAction("/schedule", "POST", { slotMinutes: 10 })
            }
          />
        ) : null}
        {event.status === "scheduled" ? (
          <ConfirmButton
            label="Start event"
            confirmTitle="Start the event?"
            confirmBody="The event goes live and judging windows become available."
            disabled={disabled}
            variant="primary"
            onConfirm={() => void lifecycleAction("/start")}
          />
        ) : null}
        {event.status === "live" ? (
          <ConfirmButton
            label="Complete event"
            confirmTitle="Complete the event?"
            confirmBody="Requires every run scored or skipped. Results can then be published."
            disabled={disabled}
            onConfirm={() => void lifecycleAction("/complete")}
          />
        ) : null}
        {event.status !== "completed" && event.status !== "cancelled" ? (
          <ConfirmButton
            label="Cancel event"
            confirmTitle="Cancel the event?"
            confirmBody="All members will be notified. This cannot be undone."
            disabled={disabled || state.myRole !== "main_organizer"}
            onConfirm={() => void lifecycleAction("/cancel")}
          />
        ) : null}
      </div>
    </section>
  );
}

function RosterPanel({
  state,
  members,
  organizer,
  inviteRole,
  setInviteRole,
  inviteExpiry,
  setInviteExpiry,
  onRegisterInvite,
  onRevokeInvite,
  onRemoveMember,
  disabled,
}: {
  state: LeagueEventState;
  members: {
    membershipId: string;
    userId: string;
    displayName: string;
    role: string;
  }[];
  organizer: boolean;
  inviteRole: "organizer" | "judge" | "rider";
  setInviteRole: (role: "organizer" | "judge" | "rider") => void;
  inviteExpiry: string;
  setInviteExpiry: (value: string) => void;
  onRegisterInvite: (
    role: "organizer" | "judge" | "rider",
    expiresInDays: number,
  ) => Promise<void>;
  onRevokeInvite: (inviteId: string) => Promise<void>;
  onRemoveMember: (membershipId: string) => Promise<void>;
  disabled: boolean;
}) {
  const paidPlan = state.event.planSlug !== "free";
  const inviteRoles = paidPlan
    ? (["rider", "judge", "organizer"] as const)
    : (["rider"] as const);
  const joinBase = typeof window === "undefined" ? "" : window.location.origin;
  const canManage = organizer && !disabled;

  return (
    <section
      id="manage-panel-roster"
      aria-labelledby="manage-tab-roster"
      className="flex flex-col gap-5"
    >
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Riders", count: state.counts.riders },
          { label: "Judges", count: state.counts.judges },
          { label: "Organizers", count: state.counts.organizers },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-center"
          >
            <p className="font-display text-xl font-bold text-on-surface">
              {stat.count}
            </p>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {organizer ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
          <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.08em] text-secondary">
            Share invites
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="invite-role"
                className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                disabled={!canManage}
                onChange={(e) =>
                  setInviteRole(e.target.value as typeof inviteRole)
                }
                className={MANAGE_CONTROL_CLASSES}
              >
                {inviteRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="invite-expiry"
                className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
              >
                Expires in
              </label>
              <select
                id="invite-expiry"
                value={inviteExpiry}
                disabled={!canManage}
                onChange={(e) => setInviteExpiry(e.target.value)}
                className={MANAGE_CONTROL_CLASSES}
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="0">No expiry</option>
              </select>
            </div>
            <button
              type="button"
              disabled={!canManage}
              onClick={() =>
                void onRegisterInvite(
                  inviteRole,
                  inviteExpiry === "0" ? 365 : Number(inviteExpiry),
                )
              }
              className="min-h-11 rounded-full bg-primary px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              Create invite
            </button>
          </div>
          {state.invites.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {state.invites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  joinBase={joinBase}
                  disabled={!canManage}
                  onRevoke={() => void onRevokeInvite(invite.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-secondary">
              No invites yet — create one and share the link or QR.
            </p>
          )}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow
            key={member.membershipId}
            displayName={member.displayName}
            role={member.role}
            isMainOrganizer={member.role === "main_organizer"}
            disabled={!canManage || state.myRole !== "main_organizer"}
            onRemove={() => void onRemoveMember(member.membershipId)}
          />
        ))}
      </ul>
    </section>
  );
}

function LivePanel({
  state,
  canJudge,
  lifecycleAction,
  onSubmitScore,
  disabled,
}: {
  state: LeagueEventState;
  canJudge: boolean;
  disabled: boolean;
  lifecycleAction: (
    path: string,
    method?: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) => Promise<unknown>;
  onSubmitScore: (
    runId: string,
    scores: Record<string, number>,
  ) => Promise<boolean>;
}) {
  return (
    <section
      id="manage-panel-live"
      aria-labelledby="manage-tab-live"
      className="flex flex-col gap-4"
    >
      <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-secondary">
        Run queue · {state.runs.length} runs
      </p>
      {state.runs.length === 0 ? (
        <p className="rounded-lg border border-outline-variant bg-surface-container-low p-6 text-sm text-secondary">
          No runs yet. Close registration and generate the schedule first.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              criteria={state.criteria}
              eventStatus={state.event.status}
              canJudge={canJudge}
              disabled={disabled}
              onOpenWindow={() =>
                void lifecycleAction(`/runs/${run.id}/window`, "POST", {
                  mode: "open",
                  windowMinutes: 10,
                })
              }
              onExtendWindow={() =>
                void lifecycleAction(`/runs/${run.id}/window`, "POST", {
                  mode: "extend",
                  windowMinutes: 5,
                })
              }
              onCloseWindow={() =>
                void lifecycleAction(`/runs/${run.id}/window`, "POST", {
                  mode: "close",
                })
              }
              onSubmitScore={(scores) => onSubmitScore(run.id, scores)}
            />
          ))}
        </ul>
      )}
      {state.event.status === "completed" && state.results.length === 0 ? (
        <ConfirmButton
          label="Publish results"
          confirmTitle="Publish results?"
          confirmBody="Freezes the ranking and awards attendance + rank points. This cannot be undone."
          variant="primary"
          disabled={disabled}
          onConfirm={() => void lifecycleAction("/results/publish")}
        />
      ) : null}
    </section>
  );
}

function ResultsPanel({
  state,
  lifecycleAction,
  disabled,
}: {
  state: LeagueEventState;
  disabled: boolean;
  lifecycleAction: (
    path: string,
    method?: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) => Promise<unknown>;
}) {
  return (
    <section
      id="manage-panel-results"
      aria-labelledby="manage-tab-results"
      className="flex flex-col gap-4"
    >
      {state.results.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {state.results.map((result) => (
            <li
              key={result.userId}
              className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-on-primary">
                  {result.rank}
                </span>
                <p className="text-sm font-semibold text-on-surface">
                  {result.riderName}
                </p>
              </div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                {result.totalScore.toFixed(2)} run · +{result.pointsAwarded}{" "}
                league pts
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-6 py-12 text-center">
          <Crown size={24} aria-hidden="true" className="text-secondary" />
          <p className="font-display text-sm font-semibold">No results yet</p>
          <p className="max-w-sm text-sm text-secondary">
            Results appear once the event completes and you publish them.
          </p>
          {state.event.status === "completed" ? (
            <ConfirmButton
              label="Publish results"
              confirmTitle="Publish results?"
              confirmBody="Freezes the ranking and awards attendance + rank points. This cannot be undone."
              variant="primary"
              disabled={disabled}
              onConfirm={() => void lifecycleAction("/results/publish")}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * Organizer metrics (spec `GET /events/[id]/dashboard`): role counts, run
 * progress, per-judge submissions, per-criterion averages. Fetched lazily
 * when the tab is opened; refreshes via the Runs tab or realtime.
 */
function MetricsPanel({ eventId }: { eventId: string }) {
  const [dashboard, setDashboard] = useState<LeagueDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/league/events/${eventId}/dashboard`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (!response.ok) {
        if (!cancelled) {
          setError("Metrics could not be loaded.");
        }
        return;
      }
      const data = (await response.json()) as LeagueDashboard;
      if (cancelled) return;
      setDashboard(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (error) {
    return (
      <section
        id="manage-panel-metrics"
        aria-labelledby="manage-tab-metrics"
        role="alert"
        className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
      >
        {error}
      </section>
    );
  }
  if (!dashboard) {
    return (
      <section
        id="manage-panel-metrics"
        aria-labelledby="manage-tab-metrics"
        className="flex flex-col gap-2"
        aria-hidden="true"
      >
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-16  rounded-lg bg-surface-container" />
        ))}
      </section>
    );
  }

  const judged = dashboard.runs.scored + dashboard.runs.skipped;

  return (
    <section
      id="manage-panel-metrics"
      aria-labelledby="manage-tab-metrics"
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Riders", value: dashboard.counts.riders },
          { label: "Judges", value: dashboard.counts.judges },
          { label: "Runs", value: dashboard.runs.total },
          {
            label: "Judged",
            value:
              dashboard.runs.total > 0
                ? `${judged}/${dashboard.runs.total}`
                : "0",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-inner border border-outline-variant bg-surface-bright p-4"
          >
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-on-surface">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-inner border border-outline-variant bg-surface-bright p-4">
        <p className="mb-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
          Criterion averages
        </p>
        {dashboard.criteria.length === 0 ? (
          <p className="text-sm text-secondary">
            Averages appear once judges submit scores.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {dashboard.criteria.map((criterion) => {
              const percent =
                criterion.maxScore > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (criterion.average / criterion.maxScore) * 100,
                      ),
                    )
                  : 0;
              return (
                <li key={criterion.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-on-surface">
                      {criterion.label}
                    </p>
                    <p className="font-display text-xs font-bold text-on-surface">
                      {criterion.average.toFixed(2)} / {criterion.maxScore}
                    </p>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${criterion.label} average`}
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-inner border border-outline-variant bg-surface-bright p-4">
        <p className="mb-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
          Judge submissions
        </p>
        {dashboard.judges.length === 0 ? (
          <p className="text-sm text-secondary">No scores submitted yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dashboard.judges.map((judge) => (
              <li
                key={judge.judgeUserId}
                className="flex items-center justify-between gap-3"
              >
                <p className="min-w-0 truncate text-sm text-on-surface">
                  {judge.judgeName}
                </p>
                <p className="shrink-0 font-display text-xs font-bold text-on-surface">
                  {judge.scoresSubmitted} submitted
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Payment plan CTA row inside the PaymentGateNotice action slot: free plan
 * self-registers at $0 (immediately paid); paid plans create a pending
 * payment an administrator marks paid.
 */
function PlanPaymentActions({
  eventId,
  version,
  disabled,
  onError,
  onDone,
}: {
  eventId: string;
  version: number;
  disabled: boolean;
  onError: (message: string) => void;
  onDone: () => Promise<void> | void;
}) {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const register = async (planSlug: string) => {
    setBusyPlan(planSlug);
    try {
      const response = await fetch(`/api/league/events/${eventId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: version,
          idempotencyKey: crypto.randomUUID(),
          planSlug,
        }),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        onError(
          raw?.message ?? raw?.error ?? "Payment could not be registered.",
        );
        return;
      }
      await onDone();
    } finally {
      setBusyPlan(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled || busyPlan !== null}
        onClick={() => void register("free")}
        className="min-h-11 rounded-full bg-primary px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary hover:opacity-90 disabled:opacity-50"
      >
        {busyPlan === "free" ? "Registering…" : "Register free plan ($0)"}
      </button>
      <button
        type="button"
        disabled={disabled || busyPlan !== null}
        onClick={() => void register("starter")}
        className="min-h-11 rounded-full border border-outline-variant px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface hover:border-outline disabled:opacity-50"
      >
        {busyPlan === "starter" ? "Requesting…" : "Request Starter ($5)"}
      </button>
      <button
        type="button"
        disabled={disabled || busyPlan !== null}
        onClick={() => void register("pro")}
        className="min-h-11 rounded-full border border-outline-variant px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface hover:border-outline disabled:opacity-50"
      >
        {busyPlan === "pro" ? "Requesting…" : "Request Pro ($21)"}
      </button>
    </div>
  );
}
