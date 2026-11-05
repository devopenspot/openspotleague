"use client";

/**
 * Organizer console for a contest (`/league/[slug]/manage`).
 * One GET state payload (version-gated ETag) drives every tab; mutations
 * carry `expectedVersion` + a UUID idempotency key and refresh the state.
 * Polls every 5 s while the event is live (dedicated realtime channel
 * wiring lands with Phase 3d).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, ClipboardList, Crown, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PaymentGateNotice } from "@/components/league/PaymentGateNotice";
import { FormSection, SelectField, TextField } from "@/components/league/form-parts";
import { ContestCoverField } from "@/components/league/cover/ContestCoverField";
import { uploadContestCover } from "@/components/league/cover/upload-contest-cover";
import { useLeagueRealtime } from "@/components/league/hooks/useLeagueRealtime";
import {
  ConfirmButton,
  InviteRow,
  MemberRow,
  RunRow,
  StateBadge,
} from "./manage-parts";
import {
  BODY,
  CARD,
  CARD_NESTED,
  CARD_TITLE,
  EMPTY_STATE,
  EYEBROW,
  LABEL,
  META,
  PAGE_TITLE,
  SEGMENTED_TRACK,
  TILE,
  alertClass,
  controlClass,
  pageContainer,
  segmentClass,
  tagClass,
} from "@/components/ui/recipes";
import { isOrganizerRole } from "@/lib/league/ui-state";
import type { LeagueDashboard, LeagueEventState } from "@/lib/services/league";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";
import { buildContestDetailUrl } from "@/lib/league/urls";

const CATEGORY_OPTIONS: readonly {
  value: LeagueEventState["event"]["category"];
  label: string;
}[] = [
  { value: "local-event", label: "Local Event" },
  { value: "festival", label: "Festival" },
  { value: "championship", label: "Championship" },
  { value: "federation", label: "Federation" },
  { value: "world-tour", label: "World Tour" },
];

const EXPIRY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "0", label: "No expiry" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "unlisted", label: "Unlisted (share link)" },
  { value: "public", label: "Public directory" },
] as const;

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
            setError("This event could not be loaded. Try again shortly.");
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
          setError("This event could not be loaded. Try again shortly.");
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
        fetchWithTimeout(`/api/league/events/${eventId}${path}`, {
          method,
          timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
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

  const uploadCover = useCallback(
    (file: File) =>
      run((version) =>
        uploadContestCover({ eventId, file, expectedVersion: version }),
      ),
    [eventId, run],
  );

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(
        `/api/league/events/${eventId}/members`,
        {
          cache: "no-store",
          timeoutMs: DEFAULT_READ_TIMEOUT_MS,
        },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { items: typeof members };
      setMembers(data.items);
    } catch {
      // Member list refresh failure is non-fatal.
    }
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
      <div className={`${pageContainer("5xl")} text-on-surface`}>
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
            <p className="sr-only">Loading the console…</p>
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div className="h-16 w-2/3 animate-pulse rounded-card bg-surface-container-high" />
              <div className="h-11 w-full animate-pulse rounded-control bg-surface-container-high" />
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-container border border-outline-variant bg-surface-container-lowest"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const event = state.event;
  const organizer = isOrganizerRole(state.myRole);
  const readOnly = state.readOnly;
  const judgeCapable = state.myRole === "judge" || organizer;

  return (
    <div className={`${pageContainer("5xl")} text-on-surface`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>
            {organizer ? "Organizer console" : "Event console"}
          </p>
          <h1 className={`mt-1 ${PAGE_TITLE}`}>{event.name}</h1>
          <p className={`mt-3 flex flex-wrap items-center gap-2 ${META}`}>
            <StateBadge status={event.status} />
            <span>
              {event.city}, {event.country}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {event.planSlug === "free" ? "Free plan" : `${event.planSlug} plan`}
            </span>
            <span aria-hidden="true">·</span>
            <span>v{event.version}</span>
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
          onClick={() => router.push(buildContestDetailUrl(event.slug))}
          className={controlClass("outline")}
        >
          View contest page
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
        <div role="alert" className={`mb-5 text-sm ${alertClass("error")}`}>
          {actionError}
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Manage sections"
        className={`mb-6 ${SEGMENTED_TRACK}`}
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
            className={segmentClass(tab === entry.id)}
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
          uploadCover={uploadCover}
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
              fetchWithTimeout(
                `/api/league/events/${eventId}/runs/${runId}/scores`,
                {
                  method: "POST",
                  timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    expectedVersion: version,
                    idempotencyKey: crypto.randomUUID(),
                    scores,
                  }),
                },
              ),
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
    </div>
  );
}

function ConfigPanel({
  state,
  lifecycleAction,
  uploadCover,
  disabled,
}: {
  state: LeagueEventState;
  lifecycleAction: (
    path: string,
    method?: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) => Promise<unknown>;
  uploadCover: (file: File) => Promise<boolean>;
  disabled: boolean;
}) {
  const event = state.event;
  const searchParams = useSearchParams();
  const coverFailed = searchParams.get("cover") === "failed";
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const categoryLabel =
    CATEGORY_OPTIONS.find((option) => option.value === event.category)?.label ??
    "";
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
    url: event.url ?? "",
    instagram: event.instagram ?? "",
    youtube: event.youtube ?? "",
  });
  const canEdit = !disabled && isOrganizerRole(state.myRole);

  return (
    <section
      id="manage-panel-config"
      aria-labelledby="manage-tab-config"
      className="flex flex-col gap-5"
    >
      <FormSection
        icon={Settings}
        title="Contest details"
        intro={
          canEdit
            ? "Edits apply together when you save."
            : "Read-only — only organizers can edit while the event is unlocked."
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="cfg-name"
            label="Name"
            value={form.name}
            disabled={!canEdit}
            onChange={(value) => setForm({ ...form, name: value })}
            className="sm:col-span-2"
          />
          <TextField
            id="cfg-start"
            type="date"
            label="Start date"
            value={form.startDate}
            disabled={!canEdit}
            onChange={(value) => setForm({ ...form, startDate: value })}
          />
          <TextField
            id="cfg-end"
            type="date"
            label="End date"
            value={form.endDate}
            disabled={!canEdit}
            onChange={(value) => setForm({ ...form, endDate: value })}
          />
          <SelectField
            id="cfg-category"
            label="Category"
            value={form.category}
            disabled={!canEdit}
            onChange={(value) => setForm({ ...form, category: value })}
            options={CATEGORY_OPTIONS}
          />
          {state.canListPublicly ? (
            <SelectField
              id="cfg-visibility"
              label="Visibility"
              value={form.visibility}
              disabled={!canEdit}
              onChange={(value) => setForm({ ...form, visibility: value })}
              options={VISIBILITY_OPTIONS}
            />
          ) : (
            <div>
              <p className={`mb-1.5 ${LABEL}`}>Visibility</p>
              <p className={BODY}>
                Private — free contests are shared with riders by QR code or
                invite link. Public listing comes with the paid plans.
              </p>
            </div>
          )}
          <TextField
            id="cfg-url"
            type="url"
            label="Official site"
            value={form.url}
            disabled={!canEdit}
            placeholder="https://"
            onChange={(value) => setForm({ ...form, url: value })}
            className="sm:col-span-2"
          />
          <TextField
            id="cfg-instagram"
            type="url"
            label="Instagram"
            value={form.instagram}
            disabled={!canEdit}
            placeholder="https://instagram.com/…"
            onChange={(value) => setForm({ ...form, instagram: value })}
          />
          <TextField
            id="cfg-youtube"
            type="url"
            label="YouTube"
            value={form.youtube}
            disabled={!canEdit}
            placeholder="https://youtube.com/…"
            onChange={(value) => setForm({ ...form, youtube: value })}
          />
        </div>
      </FormSection>

      <FormSection
        icon={Settings}
        title="Cover"
        intro="Shown on the contest page and, once public, in the directory."
      >
        {coverFailed ? (
          <div role="status" className={`mb-4 text-sm ${alertClass("neutral")}`}>
            The contest was created, but its cover could not be uploaded. Add it
            again here.
          </div>
        ) : null}
        <ContestCoverField
          id="cfg-cover"
          file={coverFile}
          onFileChange={setCoverFile}
          currentImage={event.imageUrl}
          onRemoveCurrent={
            canEdit ? () => void lifecycleAction("/cover", "DELETE") : undefined
          }
          categoryName={categoryLabel}
          sports={[]}
          disabled={!canEdit}
        />
        {coverFile ? (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() =>
              void uploadCover(coverFile).then((ok) => {
                if (ok) setCoverFile(null);
              })
            }
            className={`mt-3 ${controlClass("primary", "sm")}`}
          >
            Save cover
          </button>
        ) : null}
      </FormSection>

      <div className="flex flex-wrap items-center gap-2">
        <ConfirmButton
          label="Save changes"
          confirmTitle="Save contest details?"
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
                ...(state.canListPublicly
                  ? { visibility: form.visibility }
                  : {}),
                url: form.url.trim() || null,
                instagram: form.instagram.trim() || null,
                youtube: form.youtube.trim() || null,
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
          <div key={stat.label} className={TILE}>
            <p className="font-display text-2xl font-bold leading-none tabular-nums text-on-surface">
              {stat.count}
            </p>
            <p className={`mt-2 ${LABEL}`}>{stat.label}</p>
          </div>
        ))}
      </div>

      {organizer ? (
        <div className={CARD}>
          <h3 className={CARD_TITLE}>Share invites</h3>
          <p className={`mt-1.5 ${BODY}`}>
            Create a link or QR per role and send it to riders, judges or
            co-organizers.
          </p>
          <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <SelectField
              id="invite-role"
              label="Role"
              value={inviteRole}
              disabled={!canManage}
              onChange={setInviteRole}
              options={inviteRoles.map((role) => ({
                value: role,
                label: role.charAt(0).toUpperCase() + role.slice(1),
              }))}
            />
            <SelectField
              id="invite-expiry"
              label="Expires in"
              value={inviteExpiry}
              disabled={!canManage}
              onChange={setInviteExpiry}
              options={EXPIRY_OPTIONS}
            />
            <button
              type="button"
              disabled={!canManage}
              onClick={() =>
                void onRegisterInvite(
                  inviteRole,
                  inviteExpiry === "0" ? 365 : Number(inviteExpiry),
                )
              }
              className={controlClass("primary")}
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
            <p className={`mt-4 ${BODY}`}>
              No invites yet — create one and share the link or QR.
            </p>
          )}
        </div>
      ) : null}

      {members.length > 0 ? (
        <h3 className={EYEBROW}>Members · {members.length}</h3>
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
      <h2 className={EYEBROW}>
        Run queue · {state.runs.length} {state.runs.length === 1 ? "run" : "runs"}
      </h2>
      {state.runs.length === 0 ? (
        <div className={EMPTY_STATE}>
          <ClipboardList size={24} aria-hidden="true" className="mx-auto text-secondary" />
          <p className={`mt-3 ${CARD_TITLE}`}>No runs yet</p>
          <p className={`mx-auto mt-2 max-w-sm ${BODY}`}>
            Close registration and generate the schedule first.
          </p>
        </div>
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
              className={`flex flex-wrap items-center justify-between gap-3 ${CARD_NESTED}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary font-display text-xs font-bold tabular-nums text-on-primary">
                  {result.rank}
                </span>
                <p className="min-w-0 truncate text-sm font-semibold text-on-surface">
                  {result.riderName}
                </p>
              </div>
              <p className={`tabular-nums ${META}`}>
                {result.totalScore.toFixed(2)} run · +{result.pointsAwarded}{" "}
                league pts
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className={`flex flex-col items-center gap-3 ${EMPTY_STATE}`}>
          <Crown size={24} aria-hidden="true" className="text-secondary" />
          <p className={CARD_TITLE}>No results yet</p>
          <p className={`max-w-sm ${BODY}`}>
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
      try {
        const response = await fetchWithTimeout(
          `/api/league/events/${eventId}/dashboard`,
          {
            cache: "no-store",
            timeoutMs: DEFAULT_READ_TIMEOUT_MS,
          },
        );
        if (cancelled) return;
        if (!response.ok) {
          setError("Metrics could not be loaded.");
          return;
        }
        const data = (await response.json()) as LeagueDashboard;
        if (cancelled) return;
        setDashboard(data);
      } catch {
        if (!cancelled) {
          setError("Metrics could not be loaded.");
        }
      }
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
        className={`text-sm ${alertClass("error")}`}
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
          <div key={index} className="h-20 animate-pulse rounded-card bg-surface-container-high" />
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
            className={TILE}
          >
            <p className={LABEL}>{stat.label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-on-surface">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className={CARD}>
        <p className={`mb-3 ${EYEBROW}`}>
          Criterion averages
        </p>
        {dashboard.criteria.length === 0 ? (
          <p className={BODY}>
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
                    <p className="font-display text-xs font-bold tabular-nums text-on-surface">
                      {criterion.average.toFixed(2)} / {criterion.maxScore}
                    </p>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${criterion.label} average`}
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 w-full overflow-hidden rounded-control bg-surface-container-high"
                  >
                    <div
                      className="h-full rounded-control bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={CARD}>
        <p className={`mb-3 ${EYEBROW}`}>
          Judge submissions
        </p>
        {dashboard.judges.length === 0 ? (
          <p className={BODY}>No scores submitted yet.</p>
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
                <p className="shrink-0 font-display text-xs font-bold tabular-nums text-on-surface">
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
      const response = await fetchWithTimeout(
        `/api/league/events/${eventId}/payment`,
        {
          method: "POST",
          timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
            planSlug,
          }),
        },
      );
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        onError(
          raw?.message ?? raw?.error ?? "Payment could not be registered.",
        );
        return;
      }
      await onDone();
    } catch {
      onError("Payment could not be registered. Check your connection and try again.");
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
        className={controlClass("primary")}
      >
        {busyPlan === "free" ? "Registering…" : "Register free plan ($0)"}
      </button>
      <button
        type="button"
        disabled={disabled || busyPlan !== null}
        onClick={() => void register("starter")}
        className={controlClass("outline")}
      >
        {busyPlan === "starter" ? "Requesting…" : "Request Starter ($5)"}
      </button>
      <button
        type="button"
        disabled={disabled || busyPlan !== null}
        onClick={() => void register("pro")}
        className={controlClass("outline")}
      >
        {busyPlan === "pro" ? "Requesting…" : "Request Pro ($21)"}
      </button>
    </div>
  );
}
