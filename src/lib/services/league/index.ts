/**
 * League service — the single writer of the event section. Mirrors the games
 * engine conventions: every mutation runs inside `withDbWrite` +
 * `db.transaction` with a `SELECT … FOR UPDATE` on the event row, an
 * `expectedVersion` OCC check, fingerprint idempotency through
 * `event_action_requests`, a realtime signal row, and deferred tag
 * invalidation. Reads run in read-only repeatable-read transactions and are
 * never cached (ETag/version gating happens at the route layer).
 *
 * Business rules implemented here (docs/league.md):
 * - contests may be scheduled at most 2 months in advance;
 * - free-plan contests stay unlisted (shared by QR code); public listing
 *   needs an active paid/comped payment on a non-free plan;
 * - contest curators (league.curate, country-scoped) create comped contests
 *   and moderate any contest through the same write path (`asCurator`);
 * - payment gate: 3 days to register a plan payment (free included,
 *   self-registered), then the event is read-only (payment-only), and
 *   definitively disabled 3 days later without payment.
 */

import "server-only";
import { DEFAULT_CONTEST_IMAGE } from "@/lib/league/cover";
import {
  findEventBySlug,
  runFindEventById,
} from "@/lib/services/event/events";

import { and, desc, eq, gte, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { getDbClient, withDbRead, withDbWrite } from "@/lib/db/client";
import {
  authUsers,
  countries,
  eventActionRequests,
  eventCategories,
  eventDisciplines,
  eventDivisionEntries,
  eventDivisions,
  eventInvites,
  eventMemberships,
  eventPayments,
  eventPlans,
  eventPointsLedger,
  eventRealtimeSignals,
  eventResults,
  eventRuns,
  eventScoringCriteria,
  eventScores,
  profiles,
  riderStats,
  sportEvents,
  userEventPlans,
  type NewEventMembershipRow,
  type NewEventPaymentRow,
  type NewEventResultRow,
  type NewEventRunRow,
  type NewEventScoringCriterionRow,
  type NewSportEventRow,
} from "@/db/schema";
import { queueTagRevalidate } from "@/lib/cache/deferred";
import {
  IMAGE_CACHE_LIFE,
  ITEM_CACHE_LIFE,
  LIST_CACHE_LIFE,
  PROFILE_CACHE_LIFE,
} from "@/lib/cache/lifetimes";
import {
  ATTENDANCE_POINTS,
  FREE_PLAN_SLUG,
  INVITE_CODE_LENGTH,
  LeagueDomainError,
  PRE_LIVE_EVENT_STATUSES,
  assertTransition,
  isLeagueDomainError,
  type EventStatus,
  type PlanCaps,
} from "@/lib/league/definitions";
import { paymentNotice as leaguePaymentNotice } from "@/lib/league/notices";
import {
  addDays,
  assertCapability,
  assertCapacityForRole,
  assertEventWritable,
  assertInviteRoleAllowed,
  assertInviteUsable,
  assertPaymentWindowOpen,
  assertScheduleAdvanceWindow,
  assertScheduleReorderable,
  assertValidLeagueDateRange,
  assertVisibilityAllowed,
  assertVideoDeadline,
  buildDefaultCriteria,
  SETUP_STATUSES,
  canListPublicly,
  buildRescheduledSlots,
  buildSchedule,
  clampWindowMinutes,
  inviteCodeFromBytes,
  ledgerEventKey,
  paymentGate,
  pointsForRank,
  judgeTotal,
  type PaymentGate,
} from "@/lib/league/engine";
import {
  createNotifications,
  notifyLeagueManageAdmins,
  resolveEventRecipients,
} from "@/lib/notifications/service";
import { normalizeCitySlug } from "@/lib/league/validation";
import {
  assertElementTicks,
  bestTrickTotal,
  judgeRunTotal,
  panelScore,
} from "@/lib/league/rating/scoring";
import { elementIdsFor } from "@/lib/league/rating/elements";
import { normalizeVideoUrl } from "@/lib/league/rating/video-links";
import {
  assertVideoSubmissionOpen,
  canSeeRunVideo,
  visibleJudgeScores,
} from "@/lib/league/visibility";
import {
  FORMAT_TEMPLATES,
  divisionLabel,
  isRatingDiscipline,
  type ContestFormat,
} from "@/lib/league/rating/formats";
import type {
  CreateLeagueEventInput,
  LeagueConfigPatch,
  LeagueCreateEventResponse,
  LeagueDivisionInput,
  LeagueRiderEntry,
  LeagueInviteInput,
  LeagueMemberAddInput,
  LeagueMutationResponse,
  LeaguePaymentInput,
} from "@/lib/schemas/league";
import type { ContestCategory, ContestChangeField, ContestEnriched, EventPaymentStatus, EventRole, EventSignalType, NotificationType } from "@/types/league";
import {
  detectContestChanges,
  LOCATION_PATCH_KEYS,
  type ContestChangeSnapshot,
} from "@/lib/notifications/contest-changes";
import { log } from "@/lib/utils/log";
import { profileTag } from "@/lib/services/profile/profile";
import { rankContestDivisions, ledgerDivisionRankKey } from "@/lib/league/rating/contest-ranking";

/** League points and history feed the profile summary (activity, stats). */
function revalidateProfileTagsFor(userId: string): void {
  queueTagRevalidate(profileTag(userId), PROFILE_CACHE_LIFE);
}

type Db = ReturnType<typeof getDbClient>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const READ_TX_OPTIONS = {
  isolationLevel: "repeatable read",
  accessMode: "read only",
} as const;

const CREATE_ACTION = "create";
const UPDATE_CONFIG_ACTION = "update-config";
const SET_COVER_ACTION = "set-cover";
const REGISTER_PAYMENT_ACTION = "register-payment";
const CREATE_INVITE_ACTION = "create-invite";
const REVOKE_INVITE_ACTION = "revoke-invite";
const JOIN_ACTION = "join";
const ADD_MEMBER_ACTION = "add-member";
const REMOVE_MEMBER_ACTION = "remove-member";
const LEAVE_ACTION = "leave";
const REGISTRATION_OPEN_ACTION = "registration-open";
const REGISTRATION_CLOSE_ACTION = "registration-close";
const GENERATE_SCHEDULE_ACTION = "generate-schedule";
const REORDER_SCHEDULE_ACTION = "reorder-schedule";
const START_ACTION = "start";
const COMPLETE_ACTION = "complete";
const CANCEL_ACTION = "cancel";
const PUBLISH_RESULTS_ACTION = "publish-results";
const RUN_WINDOW_ACTION = "run-window";
const SUBMIT_SCORE_ACTION = "submit-score";
const UPDATE_ENTRY_ACTION = "update-entry";
const SUBMIT_VIDEO_ACTION = "submit-video";

// ---------- fingerprint idempotency (canonical JSON + SHA-256) ----------

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${canonicalStringify(val)}`)
    .join(",")}}`;
}

async function fingerprintFor(payload: unknown): Promise<string> {
  const canonical = canonicalStringify(payload);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function findIdempotentResult(
  tx: Tx,
  input: {
    userId: string;
    action: string;
    idempotencyKey: string;
    fingerprint: string;
  },
): Promise<LeagueMutationResponse | null> {
  const rows = await tx
    .select({
      fingerprint: eventActionRequests.requestFingerprint,
      response: eventActionRequests.responseMetadata,
    })
    .from(eventActionRequests)
    .where(
      and(
        eq(eventActionRequests.userId, input.userId),
        eq(eventActionRequests.action, input.action),
        eq(eventActionRequests.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.fingerprint !== input.fingerprint) {
    throw new LeagueDomainError(
      "IDEMPOTENCY_CONFLICT",
      "This idempotency key was already used with a different payload",
    );
  }
  return row.response as LeagueMutationResponse;
}

async function recordActionRequest(
  tx: Tx,
  input: {
    eventId: string;
    userId: string;
    action: string;
    idempotencyKey: string;
    fingerprint: string;
    resultingVersion: number;
    response: LeagueMutationResponse | LeagueCreateEventResponse;
    /** Audit extras stored next to the response (curator reason, …). */
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await tx
    .insert(eventActionRequests)
    .values({
      eventId: input.eventId,
      userId: input.userId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.fingerprint,
      resultingVersion: input.resultingVersion,
      responseMetadata: input.metadata
        ? { ...input.response, ...input.metadata }
        : input.response,
    })
    .onConflictDoNothing();
}

async function recordEventSignal(
  tx: Tx,
  input: { eventId: string; version: number; signalType: EventSignalType },
): Promise<void> {
  await tx
    .insert(eventRealtimeSignals)
    .values({
      eventId: input.eventId,
      version: input.version,
      signalType: input.signalType,
    })
    .onConflictDoNothing();
}

function queueEventTags(eventId: string): void {
  queueTagRevalidate("events:list", LIST_CACHE_LIFE);
  queueTagRevalidate("events:featured", ITEM_CACHE_LIFE);
  queueTagRevalidate(`events:item:${eventId}`, ITEM_CACHE_LIFE);
}

// ---------- shared loaders ----------

interface LockedEventRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: Date;
  version: number;
  planSlug: string;
  startAt: Date;
  endAt: Date | null;
  createdBy: string | null;
  submissionMode: "live" | "video";
  submissionDeadlineAt: Date | null;
  countryCode: string;
}

async function lockEvent(tx: Tx, eventId: string): Promise<LockedEventRow> {
  const [row] = await tx
    .select({
      id: sportEvents.id,
      slug: sportEvents.slug,
      name: sportEvents.name,
      status: sportEvents.status,
      createdAt: sportEvents.createdAt,
      version: sportEvents.version,
      planSlug: sportEvents.planSlug,
      startAt: sportEvents.startAt,
      endAt: sportEvents.endAt,
      createdBy: sportEvents.createdBy,
      submissionMode: sportEvents.submissionMode,
      submissionDeadlineAt: sportEvents.submissionDeadlineAt,
      countryCode: sportEvents.countryCode,
    })
    .from(sportEvents)
    .where(eq(sportEvents.id, eventId))
    .for("update")
    .limit(1);
  if (!row) {
    throw new LeagueDomainError("INVALID_INPUT", `Event not found: ${eventId}`);
  }
  return row;
}

async function loadMembership(
  tx: Tx,
  eventId: string,
  userId: string,
): Promise<EventRole | null> {
  const [row] = await tx
    .select({ role: eventMemberships.role })
    .from(eventMemberships)
    .where(
      and(
        eq(eventMemberships.eventId, eventId),
        eq(eventMemberships.userId, userId),
        eq(eventMemberships.status, "active"),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

interface ActivePaymentRow {
  id: string;
  planSlug: string;
  status: EventPaymentStatus;
  amountCents: number;
  provider: string;
}

async function loadActivePayment(
  tx: Tx,
  eventId: string,
): Promise<ActivePaymentRow | null> {
  return loadPaymentByStatuses(tx, eventId, ["paid", "comped"]);
}

/**
 * Any payment that blocks a new registration: the partial unique index
 * `event_payments_event_active_unique` covers pending|paid|comped, so a
 * second insert while a `pending` row awaits admin review would crash with
 * a raw constraint violation. The guard must see the same set.
 */
async function loadBlockingPayment(
  tx: Tx,
  eventId: string,
): Promise<ActivePaymentRow | null> {
  return loadPaymentByStatuses(tx, eventId, ["pending", "paid", "comped"]);
}

async function loadPaymentByStatuses(
  tx: Tx,
  eventId: string,
  statuses: [EventPaymentStatus, ...EventPaymentStatus[]],
): Promise<ActivePaymentRow | null> {
  const [row] = await tx
    .select({
      id: eventPayments.id,
      planSlug: eventPayments.planSlug,
      status: eventPayments.status,
      amountCents: eventPayments.amountCents,
      provider: eventPayments.provider,
    })
    .from(eventPayments)
    .where(
      and(
        eq(eventPayments.eventId, eventId),
        inArray(eventPayments.status, statuses),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function gateFor(
  tx: Tx,
  row: Pick<LockedEventRow, "createdAt">,
  eventId: string,
): Promise<PaymentGate> {
  const active = await loadActivePayment(tx, eventId);
  return paymentGate({
    createdAt: row.createdAt,
    hasActivePayment: Boolean(active),
    now: new Date(),
  });
}

// ---------- create ----------


// ---------- divisions (0007) ----------

export interface DivisionRow {
  id: string;
  disciplineSlug: string;
  format: ContestFormat;
  runSeconds: number | null;
  hasBestTrick: boolean;
  sortOrder: number;
}

async function loadDivisions(tx: Tx, eventId: string): Promise<DivisionRow[]> {
  const rows = await tx
    .select({
      id: eventDivisions.id,
      disciplineSlug: eventDivisions.disciplineSlug,
      format: eventDivisions.format,
      runSeconds: eventDivisions.runSeconds,
      hasBestTrick: eventDivisions.hasBestTrick,
      sortOrder: eventDivisions.sortOrder,
    })
    .from(eventDivisions)
    .where(eq(eventDivisions.eventId, eventId))
    .orderBy(eventDivisions.sortOrder, eventDivisions.id);
  return rows;
}

function ratedDivisionValues(eventId: string, divisions: readonly LeagueDivisionInput[], offset = 0) {
  return divisions.map((division, index) => {
    const template = FORMAT_TEMPLATES[division.format];
    return {
      eventId,
      disciplineSlug: division.discipline,
      format: division.format,
      runSeconds: template.runSeconds,
      hasBestTrick: template.hasBestTrick,
      sortOrder: offset + index,
    };
  });
}

/**
 * Seeds the divisions of a new contest. Rated divisions come from the
 * Article 9 templates; without them each sport gets a legacy `open`
 * division with the old 4 criteria (kept for API compatibility).
 */
async function insertContestDivisions(
  tx: Tx,
  eventId: string,
  divisions: readonly LeagueDivisionInput[] | undefined,
  sportSlugs: readonly string[],
): Promise<void> {
  if (divisions && divisions.length > 0) {
    await tx.insert(eventDivisions).values(ratedDivisionValues(eventId, divisions));
    return;
  }
  const inserted = await tx
    .insert(eventDivisions)
    .values(
      sportSlugs.map((disciplineSlug, index) => ({
        eventId,
        disciplineSlug,
        format: "open" as const,
        sortOrder: index,
      })),
    )
    .returning({ id: eventDivisions.id, sortOrder: eventDivisions.sortOrder });
  const first = inserted.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const criteriaRows: NewEventScoringCriterionRow[] = buildDefaultCriteria().map(
    (criterion, index) => ({
      eventId,
      divisionId: first?.id ?? null,
      key: criterion.key,
      label: criterion.label,
      weight: String(criterion.weight),
      maxScore: String(criterion.maxScore),
      sortOrder: index,
    }),
  );
  await tx.insert(eventScoringCriteria).values(criteriaRows);
}

/**
 * Replaces the rated divisions before any run exists. Kept divisions keep
 * their ids (and rider entries); removed ones drop their entries.
 */
async function replaceContestDivisions(
  tx: Tx,
  eventId: string,
  divisions: readonly LeagueDivisionInput[],
): Promise<void> {
  const [anyRun] = await tx
    .select({ id: eventRuns.id })
    .from(eventRuns)
    .where(eq(eventRuns.eventId, eventId))
    .limit(1);
  if (anyRun) {
    throw new LeagueDomainError(
      "INVALID_TRANSITION",
      "Divisions are fixed once runs are prepared",
    );
  }
  const current = await loadDivisions(tx, eventId);
  const wanted = new Map(divisions.map((division, index) => [`${division.discipline}:${division.format}`, index]));
  const removed = current.filter((row) => !wanted.has(`${row.disciplineSlug}:${row.format}`));
  if (removed.length > 0) {
    await tx.delete(eventDivisions).where(inArray(eventDivisions.id, removed.map((row) => row.id)));
  }
  const kept = new Set(current.map((row) => `${row.disciplineSlug}:${row.format}`));
  for (const row of current) {
    const index = wanted.get(`${row.disciplineSlug}:${row.format}`);
    if (index !== undefined && index !== row.sortOrder) {
      await tx.update(eventDivisions).set({ sortOrder: index }).where(eq(eventDivisions.id, row.id));
    }
  }
  const added = divisions
    .map((division, index) => ({ division, index }))
    .filter(({ division }) => !kept.has(`${division.discipline}:${division.format}`));
  if (added.length > 0) {
    await tx.insert(eventDivisions).values(
      added.map(({ division, index }) => ratedDivisionValues(eventId, [division], index)[0]!),
    );
  }
  const slugs = Array.from(new Set(divisions.map((division) => division.discipline)));
  await tx.delete(eventDisciplines).where(eq(eventDisciplines.eventId, eventId));
  await tx.insert(eventDisciplines).values(slugs.map((disciplineSlug) => ({ eventId, disciplineSlug })));
}

/** Validates and stores a rider's division entries (replacing previous ones). */
async function writeRiderEntries(
  tx: Tx,
  eventId: string,
  membershipId: string,
  divisionIds: readonly string[] | undefined,
): Promise<void> {
  const divisions = await loadDivisions(tx, eventId);
  let chosen: string[];
  if (!divisionIds || divisionIds.length === 0) {
    if (divisions.length !== 1) {
      throw new LeagueDomainError("INVALID_INPUT", "Pick at least one division");
    }
    chosen = [divisions[0]!.id];
  } else {
    const valid = new Set(divisions.map((division) => division.id));
    chosen = Array.from(new Set(divisionIds));
    if (chosen.some((id) => !valid.has(id))) {
      throw new LeagueDomainError("INVALID_INPUT", "That division is not part of this contest");
    }
  }
  await tx.delete(eventDivisionEntries).where(eq(eventDivisionEntries.membershipId, membershipId));
  await tx
    .insert(eventDivisionEntries)
    .values(chosen.map((divisionId) => ({ eventId, divisionId, membershipId })));
}

/** Panel score for one run: Article 9 trimmed mean, legacy plain mean. */
function runPanelScore(format: ContestFormat, totals: readonly number[]): number | null {
  if (totals.length === 0) return null;
  if (format === "open") {
    return Math.round((totals.reduce((acc, value) => acc + value, 0) / totals.length) * 100) / 100;
  }
  return panelScore(totals);
}

function divisionDisplay(division: Pick<DivisionRow, "disciplineSlug" | "format">): string {
  return isRatingDiscipline(division.disciplineSlug)
    ? divisionLabel(division.disciplineSlug, division.format)
    : `${division.disciplineSlug} · ${division.format}`;
}

export interface CreateLeagueEventOptions {
  idempotencyKey?: string;
  ip?: string;
  /**
   * Curator create (contest_curator / admin, scope checked by the route):
   * picks the plan, writes a comped payment so the gate is settled, may list
   * publicly and feature the contest, and skips the creator's monthly quota.
   */
  curator?: {
    planSlug: string;
    visibility: "public" | "unlisted";
    featured: boolean;
  };
}

/** Curator moderation of a contest the actor may not be a member of. */
export interface CuratorActionOptions {
  asCurator?: boolean;
  /** Free-text moderation note, stored with the action request. */
  reason?: string;
}

function curatorMetadata(
  options: CuratorActionOptions,
): Record<string, unknown> | undefined {
  if (!options.asCurator) return undefined;
  return { curator: true, ...(options.reason ? { reason: options.reason } : {}) };
}

/** Fields curators may moderate in any non-terminal status. */
const CURATOR_ANYTIME_PATCH_KEYS = new Set([
  "name",
  "shortName",
  "description",
  "url",
  "instagram",
  "youtube",
  "featured",
  "visibility",
]);

export async function createLeagueEvent(
  userId: string,
  input: CreateLeagueEventInput,
  options: CreateLeagueEventOptions = {},
): Promise<LeagueCreateEventResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.createEvent", () =>
    db.transaction(async (tx): Promise<LeagueCreateEventResponse> => {
      const now = new Date();
      const startAt = dateAtUtc(input.startDate);
      assertScheduleAdvanceWindow(startAt, now);
      assertValidLeagueDateRange(input.startDate, input.endDate);

      const fingerprint = await fingerprintFor({
        userId,
        ...input,
        ...(options.curator ? { curator: options.curator } : {}),
      });
      if (options.idempotencyKey) {
        const replay = await findIdempotentResult(tx, {
          userId,
          action: CREATE_ACTION,
          idempotencyKey: options.idempotencyKey,
          fingerprint,
        });
        if (replay) return replay as LeagueCreateEventResponse;
      }
      let curatorPlan: { slug: string; currency: string } | null = null;
      if (options.curator) {
        const [planRow] = await tx
          .select({ slug: eventPlans.slug, currency: eventPlans.currency })
          .from(eventPlans)
          .where(
            and(
              eq(eventPlans.slug, options.curator.planSlug),
              eq(eventPlans.active, true),
            ),
          )
          .limit(1);
        if (!planRow) {
          throw new LeagueDomainError(
            "PLAN_NOT_FOUND",
            `Payment plan not found: ${options.curator.planSlug}`,
          );
        }
        assertVisibilityAllowed(options.curator.visibility, planRow.slug);
        curatorPlan = planRow;
      } else {
        const plan = await accountPlan(tx, userId);
        const createdThisMonth = await countContestsThisMonth(
          tx,
          userId,
          now,
        );
        if (createdThisMonth >= plan.monthlyEventLimit) {
          throw new LeagueDomainError(
            "QUOTA_EXCEEDED",
            `You reached your monthly limit of ${plan.monthlyEventLimit} contests`,
          );
        }
      }

      const countryCode = await resolveCountryCode(
        tx,
        input.country,
        input.countryCode,
      );
      const [category] = await tx
        .select({ slug: eventCategories.slug })
        .from(eventCategories)
        .where(eq(eventCategories.slug, input.category))
        .limit(1);
      if (!countryCode || !category) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          !countryCode
            ? `Country not found: ${input.country}`
            : `Event category not found: ${input.category}`,
        );
      }

      const id = crypto.randomUUID();
      const slug = `${normalizeCitySlug(input.name)}-${Date.now()}`;
      const insertValues: NewSportEventRow = {
        id,
        slug,
        name: input.name,
        shortName: input.shortName ?? null,
        description: input.description,
        visibility: options.curator?.visibility ?? "unlisted",
        featured: options.curator?.featured ?? false,
        status: "draft",
        timezone: input.timezone,
        startAt,
        endAt: input.endDate ? dateAtUtc(input.endDate) : null,
        city: input.city,
        citySlug: input.citySlug ?? normalizeCitySlug(input.city),
        address: input.address ?? null,
        countryCode,
        venue: input.venue ?? null,
        location:
          typeof input.latitude === "number" &&
          typeof input.longitude === "number"
            ? { lat: input.latitude, lon: input.longitude }
            : null,
        categorySlug: input.category,
        planSlug: curatorPlan?.slug ?? FREE_PLAN_SLUG,
        imageUrl: input.imageUrl ?? DEFAULT_CONTEST_IMAGE,
        url: input.url ?? null,
        instagram: input.instagram ?? null,
        youtube: input.youtube ?? null,
        version: 0,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        paymentDueAt: addDays(now, 3),
        paymentDeadlineAt: addDays(now, 6),
        submissionMode: input.submissionMode ?? "live",
        submissionDeadlineAt: input.submissionDeadlineAt
          ? assertVideoDeadline(new Date(input.submissionDeadlineAt), startAt)
          : null,
      };
      await tx.insert(sportEvents).values(insertValues);

      const membershipValues: NewEventMembershipRow = {
        eventId: id,
        userId,
        role: "main_organizer",
        status: "active",
        addedBy: userId,
      };
      await tx.insert(eventMemberships).values(membershipValues);

      if (curatorPlan) {
        // Curated contests are comped: the gate settles immediately and the
        // payment reminder sweep never picks them up.
        await tx.insert(eventPayments).values({
          eventId: id,
          planSlug: curatorPlan.slug,
          status: "comped",
          amountCents: 0,
          currency: curatorPlan.currency,
          provider: "curator",
          payerUserId: userId,
          markedPaidBy: userId,
          paidAt: now,
          createdBy: userId,
        });
      }

      const disciplineSlugs = Array.from(
        new Set([
          ...input.sports.map((title) => title.toLowerCase()),
          ...(input.divisions ?? []).map((division) => division.discipline),
        ]),
      );
      await tx
        .insert(eventDisciplines)
        .values(
          disciplineSlugs.map((disciplineSlug) => ({
            eventId: id,
            disciplineSlug,
          })),
        );
      await insertContestDivisions(
        tx,
        id,
        input.divisions,
        input.sports.map((title) => title.toLowerCase()),
      );

      await recordEventSignal(tx, {
        eventId: id,
        version: 0,
        signalType: "event_state_changed",
      });
      queueEventTags(id);
      if (options.idempotencyKey) {
        // Persist the create attempt so a retried POST replays instead of
        // creating a second event (and double-spending monthly quota).
        await recordActionRequest(tx, {
          eventId: id,
          userId,
          action: CREATE_ACTION,
          idempotencyKey: options.idempotencyKey,
          fingerprint,
          resultingVersion: 0,
          response: { id, version: 0, slug },
        });
      }
      log.info("league.event_created", {
        eventId: id,
        userId,
        curated: Boolean(options.curator),
      });
      return { id, version: 0, slug };
    }),
  );
}

// ---------- state read ----------

export interface LeagueEventState {
  event: {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
    description: string;
    status: string;
    planSlug: string;
    visibility: string;
    timezone: string;
    category: ContestCategory;
    categoryName: string;
    imageUrl: string;
    url: string | null;
    instagram: string | null;
    youtube: string | null;
    featured: boolean;
    startDate: string;
    endDate: string | null;
    city: string;
    address: string | null;
    venue: string | null;
    country: string;
    countryCode: string;
    latitude: number | null;
    longitude: number | null;
    version: number;
    startAt: string;
    submissionMode: "live" | "video";
    submissionDeadlineAt: string | null;
    resultsPublished: boolean;
  };
  myRole: EventRole | null;
  /** The signed-in viewer (to find their own runs and scores). */
  myUserId: string;
  counts: { riders: number; judges: number; organizers: number };
  plan: { maxRiders: number | null };
  divisions: {
    id: string;
    disciplineSlug: string;
    format: ContestFormat;
    label: string;
    runSeconds: number | null;
    hasBestTrick: boolean;
    sortOrder: number;
  }[];
  /** The viewer's rider entry (riders only). */
  myEntry: {
    divisionIds: string[];
    ageCategory: "junior" | "senior" | null;
    gender: string | null;
    city: string | null;
  } | null;
  criteria: {
    key: string;
    label: string;
    weight: number;
    maxScore: number;
    sortOrder: number;
  }[];
  runs: {
    id: string;
    divisionId: string;
    sequence: number;
    riderUserId: string;
    riderName: string;
    riderAgeCategory: "junior" | "senior" | null;
    riderCity: string | null;
    status: string;
    scheduledAt: string | null;
    windowStartedAt: string | null;
    windowEndsAt: string | null;
    /** Visible to organizers, judges and the run's own rider. */
    videoUrl: string | null;
    bestTrickVideoUrl: string | null;
    videoSubmittedAt: string | null;
    /** Panel score so far (trimmed mean; legacy: plain mean). */
    panelScore: number | null;
    judgedCount: number;
    /**
     * Per-judge detail, projected by role: organizers see all, a judge sees
     * only their own, riders see none until results are published.
     */
    scores: {
      judgeUserId: string;
      judgeName: string;
      criteria: Record<string, number>;
      total: number;
      bestTrick: { difficulty: number; execution: number } | null;
      bestTrickTotal: number | null;
      elements: string[];
    }[];
  }[];
  results: {
    userId: string;
    divisionId: string;
    riderName: string;
    rank: number;
    totalScore: number;
    bestTrickScore: number | null;
    pointsAwarded: number;
  }[];
  invites: {
    id: string;
    code: string;
    role: string;
    expiresAt: string | null;
    maxUses: number | null;
    useCount: number;
    revoked: boolean;
  }[];
  payment: {
    state: PaymentGate["state"];
    paymentDueAt: string | null;
    paymentDeadlineAt: string | null;
    hasActivePayment: boolean;
    activePayment: {
      id: string;
      planSlug: string;
      status: EventPaymentStatus;
      amountCents: number;
    } | null;
  };
  /** Public listing allowed (active paid/comped payment on a non-free plan). */
  canListPublicly: boolean;
  readOnly: boolean;
  notice: { title: string; message: string } | null;
}

/**
 * Cheap version probe for the `?version=` 304 short-circuit: same visibility
 * rule as `getLeagueEventState` (event exists + active membership) without
 * fanning out the full state payload.
 */
export async function getLeagueEventVersion(
  eventId: string,
  userId: string,
): Promise<number | null> {
  const { db } = getDbClient();
  return withDbRead("league.eventVersion", async () => {
    const [row] = await db
      .select({
        version: sportEvents.version,
        isMember: sql<boolean>`exists(select 1 from ${eventMemberships} where ${and(
          eq(eventMemberships.eventId, sportEvents.id),
          eq(eventMemberships.userId, userId),
          eq(eventMemberships.status, "active"),
        )})`,
      })
      .from(sportEvents)
      .where(eq(sportEvents.id, eventId))
      .limit(1);
    if (!row || !row.isMember) return null;
    return row.version;
  });
}

export async function getLeagueEventState(
  eventId: string,
  userId: string,
  options: { asCurator?: boolean } = {},
): Promise<LeagueEventState | null> {
  const { db } = getDbClient();
  return withDbRead("league.eventState", () =>
    db.transaction(async (tx): Promise<LeagueEventState | null> => {
      const [row] = await tx
        .select({
          event: sportEvents,
          categoryName: eventCategories.name,
          countryName: countries.name,
        })
        .from(sportEvents)
        .innerJoin(
          eventCategories,
          eq(eventCategories.slug, sportEvents.categorySlug),
        )
        .innerJoin(countries, eq(countries.iso2, sportEvents.countryCode))
        .where(eq(sportEvents.id, eventId))
        .limit(1);
      if (!row) return null;
      const event = row.event;

      const myRole = await loadMembership(tx, eventId, userId);
      if (!myRole && !options.asCurator) return null;
      const activePayment = await loadActivePayment(tx, eventId);
      const gate = paymentGate({
        createdAt: event.createdAt,
        hasActivePayment: Boolean(activePayment),
        now: new Date(),
      });

      const countRows = await tx
        .select({
          role: eventMemberships.role,
          count: sql<number>`count(*)::int`,
        })
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, eventId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .groupBy(eventMemberships.role);
      const counts = { riders: 0, judges: 0, organizers: 0 };
      for (const countRow of countRows) {
        if (countRow.role === "rider") counts.riders = Number(countRow.count);
        if (countRow.role === "judge") counts.judges = Number(countRow.count);
        if (
          countRow.role === "main_organizer" ||
          countRow.role === "organizer"
        ) {
          counts.organizers += Number(countRow.count);
        }
      }

      const criteriaRows = await tx
        .select()
        .from(eventScoringCriteria)
        .where(eq(eventScoringCriteria.eventId, eventId))
        .orderBy(eventScoringCriteria.sortOrder);
      const planCaps = await eventPlanCaps(tx, event.planSlug);

      // Live console data: runs with per-judge score summaries, published
      // results (when frozen) and organizer-only invite list.
      const runRows = await tx
        .select({
          id: eventRuns.id,
          divisionId: eventRuns.divisionId,
          sequence: eventRuns.sequence,
          riderUserId: eventRuns.userId,
          riderName: profiles.displayName,
          riderAgeCategory: eventMemberships.ageCategory,
          riderCity: eventMemberships.riderCity,
          status: eventRuns.status,
          scheduledAt: eventRuns.scheduledAt,
          windowStartedAt: eventRuns.windowStartedAt,
          windowEndsAt: eventRuns.windowEndsAt,
          videoUrl: eventRuns.videoUrl,
          bestTrickVideoUrl: eventRuns.bestTrickVideoUrl,
          videoSubmittedAt: eventRuns.videoSubmittedAt,
        })
        .from(eventRuns)
        .leftJoin(profiles, eq(profiles.id, eventRuns.userId))
        .leftJoin(eventMemberships, eq(eventMemberships.id, eventRuns.membershipId))
        .where(eq(eventRuns.eventId, eventId))
        .orderBy(eventRuns.sequence);
      const divisionRows = await loadDivisions(tx, eventId);
      const divisionFormat = new Map(divisionRows.map((division) => [division.id, division.format] as const));
      const entryRows =
        myRole === "rider"
          ? await tx
              .select({
                divisionId: eventDivisionEntries.divisionId,
                ageCategory: eventMemberships.ageCategory,
                gender: eventMemberships.gender,
                city: eventMemberships.riderCity,
              })
              .from(eventMemberships)
              .leftJoin(
                eventDivisionEntries,
                eq(eventDivisionEntries.membershipId, eventMemberships.id),
              )
              .where(
                and(
                  eq(eventMemberships.eventId, eventId),
                  eq(eventMemberships.userId, userId),
                  eq(eventMemberships.status, "active"),
                ),
              )
          : [];
      const scoreRows = await tx
        .select({
          runId: eventScores.runId,
          judgeUserId: eventScores.judgeUserId,
          judgeName: profiles.displayName,
          criteria: eventScores.scores,
          total: eventScores.total,
          bestTrick: eventScores.bestTrick,
          bestTrickTotal: eventScores.bestTrickTotal,
          elements: eventScores.elements,
        })
        .from(eventScores)
        .leftJoin(profiles, eq(profiles.id, eventScores.judgeUserId))
        .where(eq(eventScores.eventId, eventId));
      const scoresByRun = new Map<string, LeagueEventState["runs"][number]["scores"]>();
      for (const score of scoreRows) {
        const list = scoresByRun.get(score.runId) ?? [];
        list.push({
          judgeUserId: score.judgeUserId,
          judgeName:
            score.judgeName ?? `Judge ${score.judgeUserId.slice(0, 6)}`,
          criteria: score.criteria,
          total: Number(score.total),
          bestTrick: score.bestTrick ?? null,
          bestTrickTotal: score.bestTrickTotal === null ? null : Number(score.bestTrickTotal),
          elements: score.elements,
        });
        scoresByRun.set(score.runId, list);
      }
      const viewer = {
        role: myRole,
        userId,
        asCurator: Boolean(options.asCurator),
        resultsPublished: Boolean(event.resultsPublishedAt),
      };
      const visibleScores = (runId: string) =>
        visibleJudgeScores(viewer, scoresByRun.get(runId) ?? []);
      const seesVideo = (riderUserId: string) => canSeeRunVideo(viewer, riderUserId);

      const publishedResults = event.resultsPublishedAt
        ? await tx
            .select({
              userId: eventResults.userId,
              divisionId: eventResults.divisionId,
              riderName: profiles.displayName,
              rank: eventResults.rank,
              totalScore: eventResults.totalScore,
              bestTrickScore: eventResults.bestTrickScore,
              pointsAwarded: eventResults.pointsAwarded,
            })
            .from(eventResults)
            .leftJoin(profiles, eq(profiles.id, eventResults.userId))
            .where(eq(eventResults.eventId, eventId))
            .orderBy(eventResults.divisionId, eventResults.rank)
        : [];
      const inviteRows =
        myRole === "main_organizer" || myRole === "organizer"
          ? await tx
              .select()
              .from(eventInvites)
              .where(eq(eventInvites.eventId, eventId))
              .orderBy(desc(eventInvites.createdAt))
          : [];

      const location = event.location as { lat: number; lon: number } | null;

      return {
        event: {
          id: event.id,
          slug: event.slug,
          name: event.name,
          shortName: event.shortName,
          description: event.description,
          status: event.status,
          planSlug: event.planSlug,
          visibility: event.visibility,
          timezone: event.timezone,
          category: event.categorySlug as ContestCategory,
          categoryName: row.categoryName,
          imageUrl: event.imageUrl,
          url: event.url,
          instagram: event.instagram,
          youtube: event.youtube,
          featured: event.featured,
          startDate: event.startAt.toISOString().slice(0, 10),
          endDate: event.endAt ? event.endAt.toISOString().slice(0, 10) : null,
          city: event.city,
          address: event.address,
          venue: event.venue,
          country: row.countryName,
          countryCode: event.countryCode,
          latitude: location?.lat ?? null,
          longitude: location?.lon ?? null,
          version: event.version,
          startAt: event.startAt.toISOString(),
          submissionMode: event.submissionMode,
          submissionDeadlineAt: event.submissionDeadlineAt?.toISOString() ?? null,
          resultsPublished: Boolean(event.resultsPublishedAt),
        },
        myRole,
        myUserId: userId,
        counts,
        plan: { maxRiders: planCaps.maxRiders },
        divisions: divisionRows.map((division) => ({
          ...division,
          label: divisionDisplay(division),
        })),
        myEntry:
          myRole === "rider" && entryRows[0]
            ? {
                divisionIds: entryRows
                  .map((entry) => entry.divisionId)
                  .filter((id): id is string => Boolean(id)),
                ageCategory: entryRows[0].ageCategory ?? null,
                gender: entryRows[0].gender ?? null,
                city: entryRows[0].city ?? null,
              }
            : null,
        criteria: criteriaRows.map((criterion) => ({
          key: criterion.key,
          label: criterion.label,
          weight: Number(criterion.weight),
          maxScore: Number(criterion.maxScore),
          sortOrder: criterion.sortOrder,
        })),
        runs: runRows.map((run) => {
          const totals = (scoresByRun.get(run.id) ?? []).map((score) => score.total);
          const video = seesVideo(run.riderUserId);
          return {
            id: run.id,
            divisionId: run.divisionId,
            sequence: run.sequence,
            riderUserId: run.riderUserId,
            riderName: run.riderName ?? `Rider ${run.riderUserId.slice(0, 6)}`,
            riderAgeCategory: run.riderAgeCategory ?? null,
            riderCity: run.riderCity ?? null,
            status: run.status,
            scheduledAt: run.scheduledAt?.toISOString() ?? null,
            windowStartedAt: run.windowStartedAt?.toISOString() ?? null,
            windowEndsAt: run.windowEndsAt?.toISOString() ?? null,
            videoUrl: video ? run.videoUrl : null,
            bestTrickVideoUrl: video ? run.bestTrickVideoUrl : null,
            videoSubmittedAt: run.videoSubmittedAt?.toISOString() ?? null,
            panelScore: runPanelScore(divisionFormat.get(run.divisionId) ?? "open", totals),
            judgedCount: totals.length,
            scores: visibleScores(run.id),
          };
        }),
        results: publishedResults.map((result) => ({
          userId: result.userId,
          divisionId: result.divisionId,
          riderName: result.riderName ?? `Rider ${result.userId.slice(0, 6)}`,
          rank: result.rank,
          totalScore: Number(result.totalScore),
          bestTrickScore: result.bestTrickScore === null ? null : Number(result.bestTrickScore),
          pointsAwarded: result.pointsAwarded,
        })),
        invites: inviteRows.map((invite) => ({
          id: invite.id,
          code: invite.code,
          role: invite.role,
          expiresAt: invite.expiresAt?.toISOString() ?? null,
          maxUses: invite.maxUses,
          useCount: invite.useCount,
          revoked: invite.revokedAt !== null,
        })),
        payment: {
          state: gate.state,
          paymentDueAt: gate.paymentDueAt?.toISOString() ?? null,
          paymentDeadlineAt: gate.paymentDeadlineAt?.toISOString() ?? null,
          hasActivePayment: Boolean(activePayment),
          activePayment: activePayment
            ? {
                id: activePayment.id,
                planSlug: activePayment.planSlug,
                status: activePayment.status,
                amountCents: activePayment.amountCents,
              }
            : null,
        },
        canListPublicly: canListPublicly(activePayment?.planSlug ?? null),
        readOnly: gate.state === "locked" || gate.state === "disabled",
        // The payment call-to-action is organizer-facing; members still
        // get the readOnly flag for action gating.
        notice:
          myRole === "main_organizer" || myRole === "organizer"
            ? paymentNotice(gate)
            : null,
      };
    }, READ_TX_OPTIONS),
  );
}

export function paymentNotice(
  gate: PaymentGate,
): { title: string; message: string } | null {
  return leaguePaymentNotice(gate);
}

/** Slug → id resolution for manage pages (read-only). */
export async function resolveLeagueEventIdBySlug(
  slug: string,
): Promise<{ id: string; slug: string } | null> {
  const { db } = getDbClient();
  return withDbRead("league.resolveBySlug", () =>
    db.transaction(async (tx): Promise<{ id: string; slug: string } | null> => {
      const [row] = await tx
        .select({ id: sportEvents.id, slug: sportEvents.slug })
        .from(sportEvents)
        .where(eq(sportEvents.slug, slug))
        .limit(1);
      return row ?? null;
    }, READ_TX_OPTIONS),
  );
}

// ---------- config update ----------

export interface UpdateLeagueConfigInput {
  eventId: string;
  expectedVersion: number;
  idempotencyKey: string;
  /** `featured` is curator-only. */
  patch: LeagueConfigPatch & { featured?: boolean };
}

/**
 * Member-facing fields (schedule, location, video deadline) this config edit
 * changes. Reads the location snapshot only when the patch can touch it; the
 * row is already locked `FOR UPDATE`.
 */
async function detectConfigChanges(
  tx: Tx,
  locked: LockedEventRow,
  patchKeys: readonly string[],
  setValues: Partial<NewSportEventRow>,
): Promise<ContestChangeField[]> {
  const touchesLocation =
    patchKeys.some((key) => LOCATION_PATCH_KEYS.has(key)) || patchKeys.includes("timezone");
  let snapshot: Omit<ContestChangeSnapshot, "startAt" | "endAt" | "submissionDeadlineAt"> = {
    timezone: null,
    city: null,
    address: null,
    venue: null,
    countryCode: locked.countryCode,
    location: null,
  };
  if (touchesLocation) {
    const [row] = await tx
      .select({
        timezone: sportEvents.timezone,
        city: sportEvents.city,
        address: sportEvents.address,
        venue: sportEvents.venue,
        countryCode: sportEvents.countryCode,
        location: sportEvents.location,
      })
      .from(sportEvents)
      .where(eq(sportEvents.id, locked.id))
      .limit(1);
    if (row) snapshot = row;
  }
  return detectContestChanges(
    {
      ...snapshot,
      startAt: locked.startAt,
      endAt: locked.endAt,
      submissionDeadlineAt: locked.submissionDeadlineAt,
    },
    {
      startAt: setValues.startAt,
      endAt: setValues.endAt,
      submissionDeadlineAt: setValues.submissionDeadlineAt,
      timezone: setValues.timezone,
      city: setValues.city,
      address: setValues.address,
      venue: setValues.venue,
      countryCode: setValues.countryCode,
      location: setValues.location,
    },
  );
}

export async function updateLeagueEventConfig(
  userId: string,
  input: UpdateLeagueConfigInput,
  options: CuratorActionOptions = {},
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.updateConfig", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const patchKeys = Object.keys(input.patch).filter(
        (key) => input.patch[key as keyof typeof input.patch] !== undefined,
      );
      if (options.asCurator) {
        // Curators moderate regardless of membership or payment gate (the
        // route checked their country scope). Copy, links, featured and
        // visibility can be fixed until the contest ends; schedule and
        // location follow the organizer rule below.
        const terminal = locked.status === "completed" || locked.status === "cancelled";
        const anytime = patchKeys.every((key) => CURATOR_ANYTIME_PATCH_KEYS.has(key));
        if (terminal || (!anytime && !PRE_LIVE_EVENT_STATUSES.has(locked.status as EventStatus))) {
          throw new LeagueDomainError(
            "INVALID_TRANSITION",
            terminal
              ? "Finished contests can no longer be edited"
              : "Schedule and location can only be edited before the contest goes live",
          );
        }
      } else {
        if (input.patch.featured !== undefined) {
          throw new LeagueDomainError(
            "NOT_AUTHORIZED",
            "Only curators can feature a contest",
          );
        }
        const role = await loadMembership(tx, locked.id, userId);
        assertCapability(role, "config.edit");
        const gate = await gateFor(tx, locked, locked.id);
        assertEventWritable(gate);
        if (!PRE_LIVE_EVENT_STATUSES.has(locked.status as EventStatus)) {
          throw new LeagueDomainError(
            "INVALID_TRANSITION",
            "Configuration can only be edited before the event goes live",
          );
        }
      }

      const fingerprint = await fingerprintFor(input);
      const replay = await findIdempotentResult(tx, {
        userId,
        action: UPDATE_CONFIG_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const patch = input.patch;
      let nextStartAt = locked.startAt;
      if (patch.startDate !== undefined) {
        nextStartAt = dateAtUtc(patch.startDate);
        assertScheduleAdvanceWindow(nextStartAt, new Date());
      }
      const nextStartDate = nextStartAt.toISOString().slice(0, 10);
      const nextEndDate =
        patch.endDate === undefined
          ? locked.endAt
            ? locked.endAt.toISOString().slice(0, 10)
            : undefined
          : (patch.endDate ?? undefined);
      assertValidLeagueDateRange(nextStartDate, nextEndDate);

      if (patch.category !== undefined) {
        const [category] = await tx
          .select({ slug: eventCategories.slug })
          .from(eventCategories)
          .where(eq(eventCategories.slug, patch.category))
          .limit(1);
        if (!category) {
          throw new LeagueDomainError(
            "INVALID_INPUT",
            `Event category not found: ${patch.category}`,
          );
        }
      }

      const setValues: Partial<NewSportEventRow> = {
        updatedAt: new Date(),
        updatedBy: userId,
        version: locked.version + 1,
      };
      if (patch.name !== undefined) setValues.name = patch.name;
      if (patch.shortName !== undefined) setValues.shortName = patch.shortName;
      if (patch.description !== undefined)
        setValues.description = patch.description;
      if (patch.startDate !== undefined) setValues.startAt = nextStartAt;
      if (patch.endDate !== undefined) {
        setValues.endAt = patch.endDate ? dateAtUtc(patch.endDate) : null;
      }
      if (patch.city !== undefined) {
        setValues.city = patch.city;
        if (patch.citySlug === undefined) {
          setValues.citySlug = normalizeCitySlug(patch.city);
        }
      }
      if (patch.citySlug !== undefined) setValues.citySlug = patch.citySlug;
      if (patch.address !== undefined) setValues.address = patch.address;
      if (patch.countryCode !== undefined) {
        const resolved = await resolveCountryCode(
          tx,
          patch.country ?? patch.countryCode,
          patch.countryCode,
        );
        if (!resolved) {
          throw new LeagueDomainError(
            "INVALID_INPUT",
            `Country not found: ${patch.country ?? patch.countryCode}`,
          );
        }
        setValues.countryCode = resolved;
      }
      if (patch.venue !== undefined) setValues.venue = patch.venue;
      if (patch.latitude !== undefined && patch.longitude !== undefined) {
        setValues.location = { lat: patch.latitude, lon: patch.longitude };
      }
      if (patch.timezone !== undefined) setValues.timezone = patch.timezone;
      if (patch.category !== undefined) setValues.categorySlug = patch.category;
      if (patch.visibility !== undefined) {
        const active = await loadActivePayment(tx, locked.id);
        assertVisibilityAllowed(patch.visibility, active?.planSlug ?? null);
        setValues.visibility = patch.visibility;
      }
      if (patch.url !== undefined) setValues.url = patch.url;
      if (patch.instagram !== undefined) setValues.instagram = patch.instagram;
      if (patch.youtube !== undefined) setValues.youtube = patch.youtube;
      if (patch.featured !== undefined) setValues.featured = patch.featured;
      const nextMode = patch.submissionMode ?? locked.submissionMode;
      if (patch.submissionMode !== undefined) setValues.submissionMode = patch.submissionMode;
      if (patch.submissionDeadlineAt !== undefined) {
        setValues.submissionDeadlineAt = patch.submissionDeadlineAt
          ? assertVideoDeadline(new Date(patch.submissionDeadlineAt), nextStartAt)
          : null;
      }
      const nextDeadline =
        patch.submissionDeadlineAt === undefined
          ? locked.submissionDeadlineAt
          : setValues.submissionDeadlineAt ?? null;
      if (nextMode === "video" && !nextDeadline) {
        throw new LeagueDomainError("INVALID_INPUT", "Video contests need a submission deadline");
      }
      if (
        (patch.submissionMode !== undefined || patch.divisions !== undefined) &&
        !SETUP_STATUSES.has(locked.status)
      ) {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          "Format and divisions can only change before runs are prepared",
        );
      }
      if (patch.divisions !== undefined) {
        await replaceContestDivisions(tx, locked.id, patch.divisions);
      }

      const contestChanges = await detectConfigChanges(tx, locked, patchKeys, setValues);

      const [updated] = await tx
        .update(sportEvents)
        .set(setValues)
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }

      if (patch.sports !== undefined) {
        await tx
          .delete(eventDisciplines)
          .where(eq(eventDisciplines.eventId, locked.id));
        const slugs = Array.from(
          new Set(patch.sports.map((title) => title.toLowerCase())),
        );
        await tx
          .insert(eventDisciplines)
          .values(
            slugs.map((disciplineSlug) => ({
              eventId: locked.id,
              disciplineSlug,
            })),
          );
      }

      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: UPDATE_CONFIG_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
        metadata: curatorMetadata(options),
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "event_state_changed",
      });
      if (contestChanges.length > 0) {
        await notifyAllMembers(tx, {
          locked,
          type: "league_contest_updated",
          payloadExtra: { changes: contestChanges },
          excludeUserIds: [userId],
        });
      }
      queueEventTags(locked.id);
      return response;
    }),
  );
}

// ---------- cover ----------

/**
 * Pre-upload guard for cover routes: the file goes to storage before the
 * write transaction, so reject non-organizers first (no orphan uploads from
 * callers who could never set a cover). The transaction re-checks.
 */
export async function assertCanEditContest(
  eventId: string,
  userId: string,
): Promise<void> {
  const { db } = getDbClient();
  const [row] = await withDbRead("league.canEditContest", () =>
    db
      .select({ role: eventMemberships.role })
      .from(eventMemberships)
      .where(
        and(
          eq(eventMemberships.eventId, eventId),
          eq(eventMemberships.userId, userId),
          eq(eventMemberships.status, "active"),
        ),
      )
      .limit(1),
  );
  assertCapability(row?.role ?? null, "config.edit");
}

export interface SetContestCoverInput {
  eventId: string;
  expectedVersion: number;
  idempotencyKey: string;
  /** Uploaded cover URL, or null to fall back to the designed cover. */
  imageUrl: string | null;
}

export interface SetContestCoverResult extends LeagueMutationResponse {
  /** Cover replaced by this call (storage cleanup is the caller's job). */
  previousImageUrl: string | null;
  /** True when the idempotency key replayed an earlier call. */
  replayed: boolean;
}

/**
 * Set or clear a contest cover (`sport_events.image_url`). The file is
 * uploaded by the route before this runs; the fingerprint deliberately covers
 * only the intent (set vs clear), so a retried upload with the same key
 * replays instead of conflicting — the caller then discards its new file.
 */
export async function setContestCover(
  userId: string,
  input: SetContestCoverInput,
  options: CuratorActionOptions = {},
): Promise<SetContestCoverResult> {
  const { db } = getDbClient();
  return withDbWrite("league.setCover", () =>
    db.transaction(async (tx): Promise<SetContestCoverResult> => {
      const locked = await lockEvent(tx, input.eventId);
      const fingerprint = await fingerprintFor({
        eventId: input.eventId,
        expectedVersion: input.expectedVersion,
        mode: input.imageUrl === null ? "clear" : "set",
      });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: SET_COVER_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return { ...replay, previousImageUrl: null, replayed: true };
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      if (!options.asCurator) {
        const role = await loadMembership(tx, locked.id, userId);
        assertCapability(role, "config.edit");
        const gate = await gateFor(tx, locked, locked.id);
        assertEventWritable(gate);
      }

      const [current] = await tx
        .select({ imageUrl: sportEvents.imageUrl })
        .from(sportEvents)
        .where(eq(sportEvents.id, locked.id))
        .limit(1);
      const previousImageUrl =
        current && current.imageUrl !== DEFAULT_CONTEST_IMAGE
          ? current.imageUrl
          : null;

      const [updated] = await tx
        .update(sportEvents)
        .set({
          imageUrl: input.imageUrl ?? DEFAULT_CONTEST_IMAGE,
          updatedAt: new Date(),
          updatedBy: userId,
          version: locked.version + 1,
        })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }

      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: SET_COVER_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
        metadata: curatorMetadata(options),
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "event_state_changed",
      });
      queueEventTags(locked.id);
      queueTagRevalidate("event-images", IMAGE_CACHE_LIFE);
      return { ...response, previousImageUrl, replayed: false };
    }),
  );
}

// ---------- payment registration ----------

export async function registerEventPayment(
  userId: string,
  input: LeaguePaymentInput & { eventId: string },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.registerPayment", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "config.edit");
      const activePayment = await loadActivePayment(tx, locked.id);
      const gate = paymentGate({
        createdAt: locked.createdAt,
        hasActivePayment: Boolean(activePayment),
        now: new Date(),
      });
      // Disabled events cannot be revived by the organizer; administrators
      // may still register a payment on their behalf (markLeaguePayment).
      assertPaymentWindowOpen(gate);

      const [plan] = await tx
        .select({
          slug: eventPlans.slug,
          priceCents: eventPlans.priceCents,
          currency: eventPlans.currency,
        })
        .from(eventPlans)
        .where(
          and(eq(eventPlans.slug, input.planSlug), eq(eventPlans.active, true)),
        )
        .limit(1);
      if (!plan) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Payment plan not found: ${input.planSlug}`,
        );
      }

      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: REGISTER_PAYMENT_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay as LeagueMutationResponse;

      const blocking = await loadBlockingPayment(tx, locked.id);
      if (blocking) {
        if (blocking.status === "pending") {
          if (blocking.planSlug === plan.slug) {
            // Same plan requested again while awaiting administrator
            // approval — repeat click, not a change request.
            return { id: locked.id, version: locked.version };
          }
          throw new LeagueDomainError(
            "PAYMENT_EXISTS",
            "A plan payment is already awaiting administrator approval; contact an administrator to change plans",
          );
        }
        if (blocking.planSlug === plan.slug) {
          // Already registered (paid/comped) — idempotent no-op.
          return { id: locked.id, version: locked.version };
        }
        if (!(blocking.provider === "self" && blocking.amountCents === 0)) {
          throw new LeagueDomainError(
            "PAYMENT_EXISTS",
            "This event already has an active payment; contact an administrator to change plans",
          );
        }
        // Supersede a free self-registration when the organizer upgrades.
        await tx
          .update(eventPayments)
          .set({
            status: "refunded",
            refundedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(eventPayments.id, blocking.id));
      }

      const now = new Date();
      const paymentValues: NewEventPaymentRow = {
        eventId: locked.id,
        planSlug: plan.slug,
        status: plan.priceCents === 0 ? "paid" : "pending",
        amountCents: plan.priceCents,
        currency: plan.currency,
        provider: "self",
        payerUserId: userId,
        paidAt: plan.priceCents === 0 ? now : null,
        createdBy: userId,
      };
      await tx.insert(eventPayments).values(paymentValues);

      const [updated] = await tx
        .update(sportEvents)
        .set({
          version: locked.version + 1,
          updatedBy: userId,
          updatedAt: now,
        })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }

      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: REGISTER_PAYMENT_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "event_state_changed",
      });
      // Fan-out (same transaction): organizers learn the gate cleared; a
      // pending paid-plan registration alerts `league.manage` admins.
      const organizerIds = await resolveEventRecipients(tx, {
        eventId: locked.id,
        roles: ["main_organizer", "organizer"],
        excludeUserIds: [userId],
      });
      await createNotifications(
        tx,
        organizerIds.map((organizerId) => ({
          userId: organizerId,
          type: "league_payment_registered",
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
            planSlug: plan.slug,
          },
          eventId: locked.id,
        })),
      );
      if (plan.priceCents > 0) {
        await notifyLeagueManageAdmins(tx, {
          type: "league_payment_pending_admin",
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
            planSlug: plan.slug,
          },
          eventId: locked.id,
        });
      }
      queueEventTags(locked.id);
      log.info("league.payment_registered", {
        eventId: locked.id,
        planSlug: plan.slug,
        status: paymentValues.status,
      });
      return response;
    }),
  );
}

// ---------- admin payment transitions ----------

export async function markLeaguePayment(
  actorUserId: string,
  input: {
    paymentId: string;
    status: "paid" | "comped" | "refunded" | "failed";
    providerReference?: string;
  },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.markPayment", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const [payment] = await tx
        .select()
        .from(eventPayments)
        .where(eq(eventPayments.id, input.paymentId))
        .for("update")
        .limit(1);
      if (!payment) {
        throw new LeagueDomainError(
          "PAYMENT_NOT_FOUND",
          `Payment not found: ${input.paymentId}`,
        );
      }
      const locked = await lockEvent(tx, payment.eventId);

      if (payment.status === input.status) {
        return { id: locked.id, version: locked.version };
      }
      if (payment.status === "refunded" || payment.status === "failed") {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          "A refunded or failed payment cannot change status again",
        );
      }

      const now = new Date();
      const updatePayment: Partial<NewEventPaymentRow> = {
        status: input.status,
        providerReference: input.providerReference ?? payment.providerReference,
        updatedAt: now,
      };
      if (input.status === "paid" || input.status === "comped") {
        updatePayment.markedPaidBy = actorUserId;
        updatePayment.paidAt = now;
      }
      if (input.status === "refunded") {
        updatePayment.refundedAt = now;
      }
      await tx
        .update(eventPayments)
        .set(updatePayment)
        .where(eq(eventPayments.id, payment.id));

      let version = locked.version;
      if (input.status === "paid" || input.status === "comped") {
        // Activating a payment unlocks the event plan and raises the payer's
        // account plan. Refunds/failed never auto-downgrade anything.
        const [updatedEvent] = await tx
          .update(sportEvents)
          .set({
            planSlug: payment.planSlug,
            version: locked.version + 1,
            updatedBy: actorUserId,
            updatedAt: now,
          })
          .where(eq(sportEvents.id, locked.id))
          .returning({ version: sportEvents.version });
        version = updatedEvent?.version ?? version;
        const payerId = payment.payerUserId ?? locked.createdBy;
        if (payerId) {
          // Highest monthly limit wins (engine spec): activating a plan must
          // never downgrade the payer's account quota.
          let nextPlanSlug = payment.planSlug;
          const [currentPlan] = await tx
            .select({ planSlug: userEventPlans.planSlug })
            .from(userEventPlans)
            .where(eq(userEventPlans.userId, payerId))
            .limit(1);
          if (currentPlan && currentPlan.planSlug !== payment.planSlug) {
            const limits = await tx
              .select({
                slug: eventPlans.slug,
                monthlyEventLimit: eventPlans.monthlyEventLimit,
              })
              .from(eventPlans)
              .where(
                inArray(eventPlans.slug, [
                  currentPlan.planSlug,
                  payment.planSlug,
                ]),
              );
            const limitBySlug = new Map(
              limits.map((row) => [row.slug, row.monthlyEventLimit] as const),
            );
            const currentLimit = limitBySlug.get(currentPlan.planSlug) ?? 0;
            const nextLimit = limitBySlug.get(payment.planSlug) ?? 0;
            nextPlanSlug =
              nextLimit >= currentLimit
                ? payment.planSlug
                : currentPlan.planSlug;
          }
          await tx
            .insert(userEventPlans)
            .values({
              userId: payerId,
              planSlug: nextPlanSlug,
              source: "payment",
              status: "active",
              grantedBy: actorUserId,
            })
            .onConflictDoUpdate({
              target: userEventPlans.userId,
              set: {
                planSlug: nextPlanSlug,
                source: "payment",
                status: "active",
                grantedBy: actorUserId,
                updatedAt: now,
              },
            });
        }
        await recordEventSignal(tx, {
          eventId: locked.id,
          version,
          signalType: "event_state_changed",
        });
        const organizerIds = await resolveEventRecipients(tx, {
          eventId: locked.id,
          roles: ["main_organizer", "organizer"],
        });
        await createNotifications(
          tx,
          organizerIds.map((organizerId) => ({
            userId: organizerId,
            type: "league_payment_registered",
            payload: {
              eventId: locked.id,
              eventSlug: locked.slug,
              eventName: locked.name,
              planSlug: payment.planSlug,
            },
            eventId: locked.id,
          })),
        );
        queueEventTags(locked.id);
      } else if (payment.status === "paid" || payment.status === "comped") {
        // Refunding/failed-marking the event's active payment re-derives the
        // gate (likely back to locked/disabled) — bump + signal + tags so
        // open consoles and caches stop showing the event as settled.
        const [updatedEvent] = await tx
          .update(sportEvents)
          .set({
            version: locked.version + 1,
            updatedBy: actorUserId,
            updatedAt: now,
          })
          .where(eq(sportEvents.id, locked.id))
          .returning({ version: sportEvents.version });
        version = updatedEvent?.version ?? version;
        await recordEventSignal(tx, {
          eventId: locked.id,
          version,
          signalType: "event_state_changed",
        });
        queueEventTags(locked.id);
      }

      log.info("league.payment_marked", {
        paymentId: payment.id,
        status: input.status,
        actor: actorUserId,
      });
      return { id: locked.id, version };
    }),
  );
}

// ---------- membership & invites (2a) ----------

/** Spec: code-join requires registration_open — draft events join via direct organizer add only. */
const JOINABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  "registration_open",
]);

async function eventPlanCaps(tx: Tx, planSlug: string): Promise<PlanCaps> {
  const [plan] = await tx
    .select({
      maxRiders: eventPlans.maxRiders,
      maxJudges: eventPlans.maxJudges,
      maxOrganizers: eventPlans.maxOrganizers,
    })
    .from(eventPlans)
    .where(eq(eventPlans.slug, planSlug))
    .limit(1);
  return plan ?? { maxRiders: 3, maxJudges: 0, maxOrganizers: 1 };
}

async function activeRoleCounts(
  tx: Tx,
  eventId: string,
): Promise<{ organizers: number; judges: number; riders: number }> {
  const rows = await tx
    .select({ role: eventMemberships.role, count: sql<number>`count(*)::int` })
    .from(eventMemberships)
    .where(
      and(
        eq(eventMemberships.eventId, eventId),
        eq(eventMemberships.status, "active"),
      ),
    )
    .groupBy(eventMemberships.role);
  let organizers = 0;
  let judges = 0;
  let riders = 0;
  for (const row of rows) {
    if (row.role === "main_organizer") organizers += Number(row.count);
    else if (row.role === "organizer") organizers += Number(row.count);
    else if (row.role === "judge") judges += Number(row.count);
    else if (row.role === "rider") riders += Number(row.count);
  }
  return { organizers, judges, riders };
}

export interface CreateEventInviteResult {
  inviteId: string;
  code: string;
  role: string;
  version: number;
}

export async function createEventInvite(
  userId: string,
  input: LeagueInviteInput & { eventId: string },
): Promise<CreateEventInviteResult> {
  const { db } = getDbClient();
  return withDbWrite("league.createInvite", () =>
    db.transaction(async (tx): Promise<CreateEventInviteResult> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "members.manage");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);

      const caps = await eventPlanCaps(tx, locked.planSlug);
      assertInviteRoleAllowed(input.role, caps);

      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: CREATE_INVITE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) {
        const [existing] = await tx
          .select({ code: eventInvites.code })
          .from(eventInvites)
          .where(eq(eventInvites.id, replay.id))
          .limit(1);
        if (existing) {
          return {
            inviteId: replay.id,
            code: existing.code,
            role: input.role,
            version: replay.version,
          };
        }
      }

      const now = new Date();
      const expiresAt = input.expiresInDays
        ? addDays(now, input.expiresInDays)
        : null;

      // Codes are unique — retry on the rare collision.
      let inviteId = crypto.randomUUID();
      let code = "";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        code = inviteCodeFromBytes(bytes, INVITE_CODE_LENGTH);
        const inserted = await tx
          .insert(eventInvites)
          .values({
            id: inviteId,
            eventId: locked.id,
            role: input.role,
            code,
            createdBy: userId,
            expiresAt,
            maxUses: input.maxUses ?? null,
          })
          .onConflictDoNothing({ target: eventInvites.code })
          .returning({ id: eventInvites.id });
        if (inserted.length > 0) break;
        inviteId = crypto.randomUUID();
      }
      if (!code) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          "Could not generate an invite code",
        );
      }

      // Parity with revoke: invite creation bumps the version and signals so
      // other organizers' consoles refresh their invite list.
      const [updated] = await tx
        .update(sportEvents)
        .set({ version: locked.version + 1, updatedBy: userId, updatedAt: now })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: CREATE_INVITE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response: { id: inviteId, version: updated.version },
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "registration_changed",
      });
      queueEventTags(locked.id);
      log.info("league.invite_created", {
        eventId: locked.id,
        role: input.role,
      });
      return { inviteId, code, role: input.role, version: updated.version };
    }),
  );
}

export async function revokeEventInvite(
  userId: string,
  input: {
    eventId: string;
    inviteId: string;
    expectedVersion: number;
    idempotencyKey: string;
  },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.revokeInvite", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "members.manage");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);

      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: REVOKE_INVITE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const [invite] = await tx
        .select()
        .from(eventInvites)
        .where(
          and(
            eq(eventInvites.id, input.inviteId),
            eq(eventInvites.eventId, locked.id),
          ),
        )
        .for("update")
        .limit(1);
      if (!invite) {
        throw new LeagueDomainError(
          "INVITE_INVALID",
          `Invite not found: ${input.inviteId}`,
        );
      }

      if (invite.revokedAt === null) {
        await tx
          .update(eventInvites)
          .set({ revokedAt: new Date() })
          .where(eq(eventInvites.id, invite.id));
        // Best-effort heads-up for members who already joined via this invite.
        const joinedVia = await tx
          .select({ userId: eventMemberships.userId })
          .from(eventMemberships)
          .where(
            and(
              eq(eventMemberships.joinedViaInviteId, invite.id),
              eq(eventMemberships.status, "active"),
            ),
          );
        await createNotifications(
          tx,
          joinedVia.map((row) => ({
            userId: row.userId,
            type: "league_invite_revoked",
            payload: {
              eventId: locked.id,
              eventSlug: locked.slug,
              eventName: locked.name,
            },
            eventId: locked.id,
          })),
        );
      }

      const [updated] = await tx
        .update(sportEvents)
        .set({
          version: locked.version + 1,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }
      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: REVOKE_INVITE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "registration_changed",
      });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export interface LeagueInvitePreview {
  eventSlug: string;
  eventName: string;
  eventStartAt: string;
  timezone: string;
  city: string;
  role: string;
  usable: boolean;
  reason: string | null;
}

export async function getInvitePreview(
  code: string,
): Promise<LeagueInvitePreview | null> {
  const { db } = getDbClient();
  return withDbRead("league.invitePreview", () =>
    db.transaction(async (tx): Promise<LeagueInvitePreview | null> => {
      const [row] = await tx
        .select({
          invite: eventInvites,
          event: {
            id: sportEvents.id,
            slug: sportEvents.slug,
            name: sportEvents.name,
            status: sportEvents.status,
            createdAt: sportEvents.createdAt,
            startAt: sportEvents.startAt,
            timezone: sportEvents.timezone,
            city: sportEvents.city,
          },
        })
        .from(eventInvites)
        .innerJoin(sportEvents, eq(sportEvents.id, eventInvites.eventId))
        .where(eq(eventInvites.code, code))
        .limit(1);
      if (!row) return null;
      const gate = paymentGate({
        createdAt: row.event.createdAt,
        hasActivePayment: Boolean(await loadActivePayment(tx, row.event.id)),
        now: new Date(),
      });
      const base = {
        eventSlug: row.event.slug,
        eventName: row.event.name,
        eventStartAt: row.event.startAt.toISOString(),
        timezone: row.event.timezone,
        city: row.event.city,
        role: row.invite.role,
      };
      try {
        assertInviteUsable(row.invite, new Date());
        if (gate.state === "disabled") {
          return { ...base, usable: false, reason: "This event was disabled" };
        }
        if (!JOINABLE_STATUSES.has(row.event.status as EventStatus)) {
          return {
            ...base,
            usable: false,
            reason: "This event is not accepting registrations",
          };
        }
        return { ...base, usable: true, reason: null };
      } catch (error) {
        if (!isLeagueDomainError(error)) throw error;
        return { ...base, usable: false, reason: error.message };
      }
    }, READ_TX_OPTIONS),
  );
}

export interface JoinLeagueEventResult extends LeagueMutationResponse {
  role: EventRole;
  eventSlug: string;
}

export async function joinEventByCode(
  userId: string,
  code: string,
  options: { idempotencyKey?: string; entry?: Partial<LeagueRiderEntry> } = {},
): Promise<JoinLeagueEventResult> {
  const { db } = getDbClient();
  return withDbWrite("league.joinByCode", () =>
    db.transaction(async (tx): Promise<JoinLeagueEventResult> => {
      // Lock order invariant: the event row is the serialization point for
      // every mutation (joins, adds, removes) — lock it first, then take the
      // invite lock, so concurrent join+revoke can never deadlock.
      const [inviteRef] = await tx
        .select({ inviteId: eventInvites.id, eventId: sportEvents.id })
        .from(eventInvites)
        .innerJoin(sportEvents, eq(sportEvents.id, eventInvites.eventId))
        .where(eq(eventInvites.code, code))
        .limit(1);
      if (!inviteRef) {
        throw new LeagueDomainError(
          "INVITE_INVALID",
          `Invite not found: ${code}`,
        );
      }
      const locked = await lockEvent(tx, inviteRef.eventId);
      const [invite] = await tx
        .select({ invite: eventInvites })
        .from(eventInvites)
        .where(eq(eventInvites.id, inviteRef.inviteId))
        .for("update")
        .limit(1);
      if (!invite) {
        throw new LeagueDomainError(
          "INVITE_INVALID",
          `Invite not found: ${code}`,
        );
      }
      const fingerprint = await fingerprintFor({ userId, code, entry: options.entry ?? null });
      if (options.idempotencyKey) {
        const replay = await findIdempotentResult(tx, {
          userId,
          action: JOIN_ACTION,
          idempotencyKey: options.idempotencyKey,
          fingerprint,
        });
        if (replay) {
          const role = await loadMembership(tx, locked.id, userId);
          if (role) {
            return {
              id: locked.id,
              version: replay.version,
              role,
              eventSlug: locked.slug,
            };
          }
        }
      }

      assertInviteUsable(invite.invite, new Date());
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      if (!JOINABLE_STATUSES.has(locked.status as EventStatus)) {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          "This event is not accepting registrations",
        );
      }
      const existingRole = await loadMembership(tx, locked.id, userId);
      if (existingRole) {
        throw new LeagueDomainError(
          "ALREADY_MEMBER",
          "You already have a role in this event",
        );
      }
      const caps = await eventPlanCaps(tx, locked.planSlug);
      const counts = await activeRoleCounts(tx, locked.id);
      const inviteRole = invite.invite.role as "organizer" | "judge" | "rider";
      assertCapacityForRole(inviteRole, caps, counts);

      const now = new Date();
      const membershipValues: NewEventMembershipRow = {
        eventId: locked.id,
        userId,
        role: inviteRole,
        status: "active",
        joinedViaInviteId: invite.invite.id,
        addedBy: userId,
        ...(inviteRole === "rider"
          ? {
              ageCategory: options.entry?.ageCategory ?? null,
              gender: options.entry?.gender ?? null,
              riderCity: options.entry?.city ?? null,
            }
          : {}),
      };
      const [insertedMembership] = await tx
        .insert(eventMemberships)
        .values(membershipValues)
        .returning({ id: eventMemberships.id });
      if (inviteRole === "rider" && insertedMembership) {
        await writeRiderEntries(tx, locked.id, insertedMembership.id, options.entry?.divisionIds);
      }
      await tx
        .update(eventInvites)
        .set({ useCount: invite.invite.useCount + 1 })
        .where(eq(eventInvites.id, invite.invite.id));

      const [updated] = await tx
        .update(sportEvents)
        .set({ version: locked.version + 1, updatedBy: userId, updatedAt: now })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }

      if (options.idempotencyKey) {
        const response: LeagueMutationResponse = {
          id: updated.id,
          version: updated.version,
        };
        await recordActionRequest(tx, {
          eventId: locked.id,
          userId,
          action: JOIN_ACTION,
          idempotencyKey: options.idempotencyKey,
          fingerprint,
          resultingVersion: updated.version,
          response,
        });
      }
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "registration_changed",
      });
      const [joinerName] = await tx
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      const joinerPayload = {
        eventId: locked.id,
        eventSlug: locked.slug,
        eventName: locked.name,
        role: inviteRole,
      };
      await createNotifications(tx, [
        {
          userId,
          type: "league_registration_confirmed",
          payload: joinerPayload,
          eventId: locked.id,
        },
      ]);
      const organizerIds = await resolveEventRecipients(tx, {
        eventId: locked.id,
        roles: ["main_organizer", "organizer"],
        excludeUserIds: [userId],
      });
      await createNotifications(
        tx,
        organizerIds.map((organizerId) => ({
          userId: organizerId,
          type: "league_registration_confirmed",
          payload: { ...joinerPayload, actorName: joinerName?.displayName },
          eventId: locked.id,
        })),
      );
      queueEventTags(locked.id);
      log.info("league.member_joined", {
        eventId: locked.id,
        userId,
        role: inviteRole,
      });
      return {
        id: updated.id,
        version: updated.version,
        role: inviteRole,
        eventSlug: locked.slug,
      };
    }),
  );
}

export interface LeagueMemberItem {
  membershipId: string;
  userId: string;
  displayName: string;
  role: EventRole;
  joinedAt: string;
}

export async function listEventMembers(
  userId: string,
  eventId: string,
): Promise<LeagueMemberItem[]> {
  const { db } = getDbClient();
  return withDbRead("league.listMembers", () =>
    db.transaction(async (tx): Promise<LeagueMemberItem[]> => {
      const role = await loadMembership(tx, eventId, userId);
      const locked = await lockEvent(tx, eventId);
      if (!role && locked.createdBy !== userId) {
        throw new LeagueDomainError(
          "NOT_AUTHORIZED",
          "You are not a member of this event",
        );
      }
      const rows = await tx
        .select({
          membershipId: eventMemberships.id,
          userId: eventMemberships.userId,
          displayName: profiles.displayName,
          role: eventMemberships.role,
          joinedAt: eventMemberships.joinedAt,
        })
        .from(eventMemberships)
        .leftJoin(profiles, eq(profiles.id, eventMemberships.userId))
        .where(
          and(
            eq(eventMemberships.eventId, eventId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .orderBy(eventMemberships.joinedAt, eventMemberships.userId);
      return rows.map((row) => ({
        membershipId: row.membershipId,
        userId: row.userId,
        displayName: row.displayName || `Rider ${row.userId.slice(0, 6)}`,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
      }));
    }, READ_TX_OPTIONS),
  );
}

export async function addEventMember(
  userId: string,
  input: LeagueMemberAddInput & { eventId: string },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.addMember", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "members.manage");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);

      const fingerprint = await fingerprintFor({ actorId: userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: ADD_MEMBER_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const [targetProfile] = await tx
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, input.userId))
        .limit(1);
      if (!targetProfile) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `User not found: ${input.userId}`,
        );
      }
      const existingRole = await loadMembership(tx, locked.id, input.userId);
      if (existingRole) {
        throw new LeagueDomainError(
          "ALREADY_MEMBER",
          "This user already has a role in the event",
        );
      }
      const caps = await eventPlanCaps(tx, locked.planSlug);
      const counts = await activeRoleCounts(tx, locked.id);
      assertInviteRoleAllowed(input.role, caps);
      assertCapacityForRole(input.role, caps, counts);

      const now = new Date();
      const membershipValues: NewEventMembershipRow = {
        eventId: locked.id,
        userId: input.userId,
        role: input.role,
        status: "active",
        addedBy: userId,
      };
      await tx.insert(eventMemberships).values(membershipValues);

      const [updated] = await tx
        .update(sportEvents)
        .set({ version: locked.version + 1, updatedBy: userId, updatedAt: now })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }
      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: ADD_MEMBER_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "registration_changed",
      });
      await createNotifications(tx, [
        {
          userId: input.userId,
          type: "league_member_added",
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
            role: input.role,
          },
          eventId: locked.id,
        },
      ]);
      queueEventTags(locked.id);
      log.info("league.member_added", {
        eventId: locked.id,
        target: input.userId,
        role: input.role,
      });
      return response;
    }),
  );
}

export async function removeEventMember(
  userId: string,
  input: {
    eventId: string;
    membershipId: string;
    expectedVersion: number;
    idempotencyKey: string;
  },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.removeMember", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "members.remove");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);

      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: REMOVE_MEMBER_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const [target] = await tx
        .select()
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.id, input.membershipId),
            eq(eventMemberships.eventId, locked.id),
          ),
        )
        .limit(1);
      if (!target || target.status !== "active") {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Active membership not found: ${input.membershipId}`,
        );
      }
      if (target.role === "main_organizer") {
        throw new LeagueDomainError(
          "NOT_AUTHORIZED",
          "The main organizer cannot be removed; cancel the event instead",
        );
      }

      const now = new Date();
      await tx
        .update(eventMemberships)
        .set({ status: "removed", removedAt: now, removedBy: userId })
        .where(eq(eventMemberships.id, target.id));

      const [updated] = await tx
        .update(sportEvents)
        .set({ version: locked.version + 1, updatedBy: userId, updatedAt: now })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }
      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: REMOVE_MEMBER_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "registration_changed",
      });
      await createNotifications(tx, [
        {
          userId: target.userId,
          type: "league_member_removed",
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
          },
          eventId: locked.id,
        },
      ]);
      // Co-organizers learn about roster changes they didn't perform
      // (api.spec trigger map: member removed → recipient + co-organizers).
      const otherOrganizers = await resolveEventRecipients(tx, {
        eventId: locked.id,
        roles: ["main_organizer", "organizer"],
        excludeUserIds: [userId, target.userId],
      });
      const [actorProfile] = await tx
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      await createNotifications(
        tx,
        otherOrganizers.map((organizerId) => ({
          userId: organizerId,
          type: "league_member_removed" as NotificationType,
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
            actorName: actorProfile?.displayName ?? undefined,
          },
          eventId: locked.id,
        })),
      );
      queueEventTags(locked.id);
      log.info("league.member_removed", {
        eventId: locked.id,
        target: target.userId,
        actor: userId,
      });
      return response;
    }),
  );
}

export async function leaveEvent(
  userId: string,
  input: { eventId: string; idempotencyKey: string },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.leave", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      const role = await loadMembership(tx, locked.id, userId);
      if (!role) {
        throw new LeagueDomainError(
          "NOT_AUTHORIZED",
          "You are not a member of this event",
        );
      }
      if (role === "main_organizer") {
        throw new LeagueDomainError(
          "NOT_AUTHORIZED",
          "The main organizer cannot leave; cancel the event instead",
        );
      }
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);

      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: LEAVE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const now = new Date();
      await tx
        .update(eventMemberships)
        .set({ status: "withdrawn", removedAt: now, removedBy: userId })
        .where(
          and(
            eq(eventMemberships.eventId, locked.id),
            eq(eventMemberships.userId, userId),
            eq(eventMemberships.status, "active"),
          ),
        );

      const [updated] = await tx
        .update(sportEvents)
        .set({ version: locked.version + 1, updatedBy: userId, updatedAt: now })
        .where(eq(sportEvents.id, locked.id))
        .returning({ id: sportEvents.id, version: sportEvents.version });
      if (!updated) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Event not found: ${locked.id}`,
        );
      }
      const response: LeagueMutationResponse = {
        id: updated.id,
        version: updated.version,
      };
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: LEAVE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: updated.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: updated.version,
        signalType: "registration_changed",
      });
      queueEventTags(locked.id);
      log.info("league.member_left", { eventId: locked.id, userId });
      return response;
    }),
  );
}

// ---------- lifecycle (2b) & runs/scores/results (2c) ----------

async function bumpEventVersion(
  tx: Tx,
  eventId: string,
  userId: string,
  extra: Partial<NewSportEventRow> = {},
): Promise<LeagueMutationResponse> {
  const [updated] = await tx
    .update(sportEvents)
    .set({
      ...extra,
      version: sql`${sportEvents.version} + 1`,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(sportEvents.id, eventId))
    .returning({ id: sportEvents.id, version: sportEvents.version });
  if (!updated) {
    throw new LeagueDomainError("INVALID_INPUT", `Event not found: ${eventId}`);
  }
  return { id: updated.id, version: updated.version };
}

async function notifyAllMembers(
  tx: Tx,
  input: {
    locked: LockedEventRow;
    type: NotificationType;
    payloadExtra?: Record<string, unknown>;
    excludeUserIds?: readonly string[];
  },
): Promise<void> {
  const recipients = await resolveEventRecipients(tx, {
    eventId: input.locked.id,
    excludeUserIds: input.excludeUserIds,
  });
  await createNotifications(
    tx,
    recipients.map((recipientId) => ({
      userId: recipientId,
      type: input.type,
      payload: {
        eventId: input.locked.id,
        eventSlug: input.locked.slug,
        eventName: input.locked.name,
        ...input.payloadExtra,
      },
      eventId: input.locked.id,
    })),
  );
}

/**
 * Tells organizers once that every run is scored or skipped (ready to
 * complete). Safe to call after any run status change: the per-organizer
 * `dedupe_key` makes repeat calls no-ops.
 */
async function notifyIfScoringComplete(tx: Tx, locked: LockedEventRow): Promise<void> {
  const [counts] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${eventRuns.status} not in ('scored','skipped'))::int`,
    })
    .from(eventRuns)
    .where(eq(eventRuns.eventId, locked.id));
  if (!counts || Number(counts.total) === 0 || Number(counts.open) > 0) return;
  const organizerIds = await resolveEventRecipients(tx, {
    eventId: locked.id,
    roles: ["main_organizer", "organizer"],
  });
  await createNotifications(
    tx,
    organizerIds.map((organizerId) => ({
      userId: organizerId,
      type: "league_scoring_complete",
      payload: { eventId: locked.id, eventSlug: locked.slug, eventName: locked.name },
      eventId: locked.id,
      dedupeKey: `scored:${locked.id}:${organizerId}`,
    })),
  );
}

interface LifecycleMutationInput {
  eventId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export async function openEventRegistration(
  userId: string,
  input: LifecycleMutationInput,
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.openRegistration", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      assertTransition(locked.status as EventStatus, "registration_open");
      if (locked.startAt.getTime() <= Date.now()) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          "Registration can only open while the event start date is in the future",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: REGISTRATION_OPEN_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "registration_open",
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: REGISTRATION_OPEN_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "registration_changed",
      });
      await notifyAllMembers(tx, {
        locked,
        type: "league_registration_opened",
        excludeUserIds: [userId],
      });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function closeEventRegistration(
  userId: string,
  input: LifecycleMutationInput,
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.closeRegistration", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      assertTransition(locked.status as EventStatus, "registration_closed");
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: REGISTRATION_CLOSE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "registration_closed",
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: REGISTRATION_CLOSE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "registration_changed",
      });
      await notifyAllMembers(tx, {
        locked,
        type: "league_registration_closed",
        excludeUserIds: [userId],
      });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function generateEventSchedule(
  userId: string,
  input: LifecycleMutationInput & { slotMinutes?: number },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.generateSchedule", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      assertTransition(locked.status as EventStatus, "scheduled");
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: GENERATE_SCHEDULE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const riderUserIds = await tx
        .select({ id: eventMemberships.id, userId: eventMemberships.userId })
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, locked.id),
            eq(eventMemberships.role, "rider"),
            eq(eventMemberships.status, "active"),
          ),
        )
        .orderBy(eventMemberships.joinedAt);
      const userIdByMembership = new Map(
        riderUserIds.map((row) => [row.id, row.userId] as const),
      );
      // One run per rider per entered division: division order, then join
      // order. Riders without an entry (pre-0007 joins) ride the first one.
      const divisions = await loadDivisions(tx, locked.id);
      const entries = await tx
        .select({
          membershipId: eventDivisionEntries.membershipId,
          divisionId: eventDivisionEntries.divisionId,
        })
        .from(eventDivisionEntries)
        .where(eq(eventDivisionEntries.eventId, locked.id));
      const entered = new Set(entries.map((entry) => `${entry.divisionId}:${entry.membershipId}`));
      const enteredAny = new Set(entries.map((entry) => entry.membershipId));
      const slots: { membershipId: string; divisionId: string }[] = [];
      divisions.forEach((division, divisionIndex) => {
        for (const rider of riderUserIds) {
          const inDivision =
            entered.has(`${division.id}:${rider.id}`) ||
            (divisionIndex === 0 && !enteredAny.has(rider.id));
          if (inDivision) slots.push({ membershipId: rider.id, divisionId: division.id });
        }
      });
      const planned = buildSchedule({
        riderMembershipIds: slots.map((slot) => slot.membershipId),
        startAt: locked.startAt,
        slotMinutes: input.slotMinutes,
      });
      const video = locked.submissionMode === "video";
      const runRows: NewEventRunRow[] = planned.map((slot, index) => ({
        eventId: locked.id,
        membershipId: slot.membershipId,
        divisionId: slots[index]!.divisionId,
        userId: userIdByMembership.get(slot.membershipId) ?? "",
        stage: "final",
        sequence: slot.sequence,
        // Video runs have no slot: riders submit until the deadline.
        scheduledAt: video ? null : slot.scheduledAt,
      }));
      await tx.insert(eventRuns).values(runRows);

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "scheduled",
        schedulePublishedAt: new Date(),
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: GENERATE_SCHEDULE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "schedule_published",
      });
      await notifyAllMembers(tx, {
        locked,
        type: "league_schedule_published",
      });
      queueEventTags(locked.id);
      log.info("league.schedule_generated", {
        eventId: locked.id,
        runs: runRows.length,
      });
      return response;
    }),
  );
}

export interface LeagueScheduleReorderMutation {
  eventId: string;
  expectedVersion: number;
  idempotencyKey: string;
  slotMinutes?: number;
  runs: { runId: string; sequence: number }[];
}

/**
 * Run reorder (engine spec: "organizer may reorder/reschedule runs while
 * scheduled — and while live for not-yet-judged runs"): renumbers every run
 * and re-derives `scheduled_at` from `start_at + (sequence-1) × slot`, so the
 * payload must cover every run exactly once with contiguous sequences.
 */
export async function reorderEventSchedule(
  userId: string,
  input: LeagueScheduleReorderMutation,
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.reorderSchedule", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);

      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: REORDER_SCHEDULE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const runRows = await tx
        .select({ id: eventRuns.id, status: eventRuns.status })
        .from(eventRuns)
        .where(eq(eventRuns.eventId, locked.id));
      if (runRows.length === 0) {
        throw new LeagueDomainError(
          "EMPTY_SCHEDULE",
          "Nothing to reorder — generate the schedule first",
        );
      }
      assertScheduleReorderable(
        locked.status as EventStatus,
        runRows.map((row) => row.status),
      );

      const runIds = new Set(runRows.map((row) => row.id));
      const sequenceByRunId = new Map(
        input.runs.map((entry) => [entry.runId, entry.sequence] as const),
      );
      const coversEveryRunExactlyOnce =
        sequenceByRunId.size === runIds.size &&
        input.runs.every((entry) => runIds.has(entry.runId));
      const sequences = input.runs.map((entry) => entry.sequence);
      const contiguous =
        new Set(sequences).size === runIds.size &&
        sequences.every((sequence) => sequence >= 1 && sequence <= runIds.size);
      if (!contiguous) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          "Run sequences must be contiguous starting at 1",
        );
      }
      if (!coversEveryRunExactlyOnce) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          "Every run must appear exactly once in the reorder payload",
        );
      }

      const slots = buildRescheduledSlots({
        runs: input.runs,
        startAt: locked.startAt,
        slotMinutes: input.slotMinutes,
      });
      for (const slot of slots) {
        await tx
          .update(eventRuns)
          .set({
            sequence: slot.sequence,
            scheduledAt: slot.scheduledAt,
            updatedAt: new Date(),
          })
          .where(eq(eventRuns.id, slot.runId));
      }

      const response = await bumpEventVersion(tx, locked.id, userId);
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: REORDER_SCHEDULE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "schedule_published",
      });
      queueEventTags(locked.id);
      log.info("league.schedule_reordered", {
        eventId: locked.id,
        runs: runIds.size,
      });
      return response;
    }),
  );
}

export async function startEvent(
  userId: string,
  input: LifecycleMutationInput,
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.startEvent", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      assertTransition(locked.status as EventStatus, "live");
      const [runCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(eventRuns)
        .where(eq(eventRuns.eventId, locked.id));
      if (Number(runCount?.count ?? 0) === 0) {
        throw new LeagueDomainError(
          "EMPTY_SCHEDULE",
          "Generate the schedule before starting",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: START_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "live",
        startedAt: new Date(),
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: START_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "event_state_changed",
      });
      await notifyAllMembers(tx, { locked, type: "league_event_started" });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function completeEvent(
  userId: string,
  input: LifecycleMutationInput,
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.completeEvent", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      assertTransition(locked.status as EventStatus, "completed");
      if (
        locked.submissionMode === "video" &&
        locked.submissionDeadlineAt &&
        locked.submissionDeadlineAt.getTime() <= Date.now()
      ) {
        // Past the deadline, runs that never got a video are skipped.
        await tx
          .update(eventRuns)
          .set({ status: "skipped", updatedAt: new Date() })
          .where(and(eq(eventRuns.eventId, locked.id), eq(eventRuns.status, "scheduled")));
      }
      const unfinished = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(eventRuns)
        .where(
          and(
            eq(eventRuns.eventId, locked.id),
            sql`${eventRuns.status} not in ('scored','skipped')`,
          ),
        );
      if (Number(unfinished[0]?.count ?? 0) > 0) {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          locked.submissionMode === "video"
            ? "Every submitted video needs a score, and missing videos are skipped once the deadline passes"
            : "Every run must be scored or skipped before completing",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: COMPLETE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "completed",
        completedAt: new Date(),
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: COMPLETE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "event_state_changed",
      });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function cancelEvent(
  userId: string,
  input: LifecycleMutationInput,
  options: CuratorActionOptions = {},
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.cancelEvent", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      if (!options.asCurator) {
        const role = await loadMembership(tx, locked.id, userId);
        assertCapability(role, "event.cancel");
        const gate = await gateFor(tx, locked, locked.id);
        assertEventWritable(gate);
      }
      assertTransition(locked.status as EventStatus, "cancelled");
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: CANCEL_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "cancelled",
        cancelledAt: new Date(),
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: CANCEL_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
        metadata: curatorMetadata(options),
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "event_cancelled",
      });
      await notifyAllMembers(tx, { locked, type: "league_event_cancelled" });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function publishEventResults(
  userId: string,
  input: LifecycleMutationInput,
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.publishResults", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      // Publishing is legal on `completed` (spec default) and as an early
      // publish from `live` — either way the event completes atomically with
      // the publish, so a `live` event never carries frozen results.
      assertTransition(locked.status as EventStatus, "completed");
      const [alreadyPublished] = await tx
        .select({ publishedAt: sportEvents.resultsPublishedAt })
        .from(sportEvents)
        .where(eq(sportEvents.id, locked.id))
        .limit(1);
      if (alreadyPublished?.publishedAt) {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          "Results were already published for this event",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: PUBLISH_RESULTS_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const runRows = await tx
        .select({
          id: eventRuns.id,
          membershipId: eventRuns.membershipId,
          userId: eventRuns.userId,
          divisionId: eventRuns.divisionId,
          sequence: eventRuns.sequence,
          status: eventRuns.status,
        })
        .from(eventRuns)
        .where(
          and(
            eq(eventRuns.eventId, locked.id),
            inArray(eventRuns.status, ["scored", "skipped"]),
          ),
        )
        .orderBy(eventRuns.sequence);
      const scoreRows = await tx
        .select({
          runId: eventScores.runId,
          total: eventScores.total,
          scores: eventScores.scores,
          bestTrickTotal: eventScores.bestTrickTotal,
        })
        .from(eventScores)
        .where(eq(eventScores.eventId, locked.id));
      const divisions = await loadDivisions(tx, locked.id);
      const ranked = rankContestDivisions(divisions, runRows, scoreRows);
      if (ranked.length === 0) {
        throw new LeagueDomainError("NOT_SCORED", "No scored runs to rank");
      }
      const divisionById = new Map(divisions.map((division) => [division.id, division] as const));

      const now = new Date();
      const resultRows: NewEventResultRow[] = [];
      const ledgerRows: {
        userId: string;
        eventKey: string;
        eventType: "event_attended" | "event_rank_bonus";
        points: number;
        rank: number | null;
        divisionId: string | null;
        disciplineSlug: string | null;
        format: string | null;
      }[] = [];
      // Attendance once per contest for every rider with a scored or skipped run.
      for (const attendeeId of new Set(runRows.map((run) => run.userId))) {
        ledgerRows.push({
          userId: attendeeId,
          eventKey: ledgerEventKey(locked.id, attendeeId, "attended"),
          eventType: "event_attended",
          points: ATTENDANCE_POINTS,
          rank: null,
          divisionId: null,
          disciplineSlug: null,
          format: null,
        });
      }
      // Each division ranks on its own: a result + rank bonus per division.
      for (const entry of ranked) {
        const division = divisionById.get(entry.divisionId);
        resultRows.push({
          eventId: locked.id,
          divisionId: entry.divisionId,
          userId: entry.userId,
          runId: entry.runId,
          totalScore: String(entry.score),
          bestTrickScore: entry.bestTrickScore === null ? null : String(entry.bestTrickScore),
          rank: entry.rank,
          pointsAwarded: pointsForRank(entry.rank),
        });
        ledgerRows.push({
          userId: entry.userId,
          eventKey: ledgerDivisionRankKey(locked.id, entry.divisionId, entry.userId),
          eventType: "event_rank_bonus",
          points: pointsForRank(entry.rank) - ATTENDANCE_POINTS,
          rank: entry.rank,
          divisionId: entry.divisionId,
          disciplineSlug: division?.disciplineSlug ?? null,
          format: division?.format ?? null,
        });
      }
      await tx.insert(eventResults).values(resultRows);
      await tx
        .insert(eventPointsLedger)
        .values(
          ledgerRows.map((row) => ({
            eventId: locked.id,
            userId: row.userId,
            eventKey: row.eventKey,
            eventType: row.eventType,
            points: row.points,
            rank: row.rank,
            divisionId: row.divisionId,
            disciplineSlug: row.disciplineSlug,
            format: row.format,
            countryCode: locked.countryCode,
          })),
        )
        .onConflictDoNothing({ target: eventPointsLedger.eventKey });

      // Rider stats aggregate (attendance/win counts + total points).
      const stats = new Map<
        string,
        { points: number; won: number; attended: number }
      >();
      for (const row of ledgerRows) {
        const current = stats.get(row.userId) ?? {
          points: 0,
          won: 0,
          attended: 0,
        };
        current.points += row.points;
        if (row.eventType === "event_attended") current.attended += 1;
        stats.set(row.userId, current);
      }
      // A contest counts once as won when the rider wins any division.
      const winnerUserIds = new Set(
        ranked.filter((entry) => entry.rank === 1).map((entry) => entry.userId),
      );
      for (const [statUserId, value] of stats) {
        const won = winnerUserIds.has(statUserId) ? 1 : 0;
        await tx
          .insert(riderStats)
          .values({
            userId: statUserId,
            totalPoints: value.points,
            eventsAttended: value.attended,
            eventsWon: won,
          })
          .onConflictDoUpdate({
            target: riderStats.userId,
            set: {
              totalPoints: sql`${riderStats.totalPoints} + ${value.points}`,
              eventsAttended: sql`${riderStats.eventsAttended} + ${value.attended}`,
              eventsWon: sql`${riderStats.eventsWon} + ${won}`,
              updatedAt: now,
            },
          });
      }

      const response = await bumpEventVersion(tx, locked.id, userId, {
        status: "completed",
        completedAt: now,
        resultsPublishedAt: now,
      });
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: PUBLISH_RESULTS_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "results_published",
      });
      await createNotifications(
        tx,
        ranked.map((entry) => {
          return {
            userId: entry.userId,
            type: "league_results_published" as NotificationType,
            payload: {
              eventId: locked.id,
              eventSlug: locked.slug,
              eventName: locked.name,
              rank: entry.rank,
              points: pointsForRank(entry.rank),
            },
            eventId: locked.id,
          };
        }),
      );
      // Judges, organizers and unranked members hear the results are out
      // (no placement in their payload).
      await notifyAllMembers(tx, {
        locked,
        type: "league_results_published",
        excludeUserIds: ranked.map((entry) => entry.userId),
      });
      // Points-ledger trigger (api.spec): every ranked rider also gets the
      // earned-points row so the digest reflects totals, not just placement.
      await createNotifications(
        tx,
        Array.from(stats.entries()).map(([statUserId, value]) => ({
          userId: statUserId,
          type: "league_points_earned" as NotificationType,
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
            points: value.points,
          },
          eventId: locked.id,
        })),
      );
      queueEventTags(locked.id);
      // Rider stats changed — ranking caches must not outlive the publish.
      queueTagRevalidate("ranking:global", LIST_CACHE_LIFE);
      for (const statUserId of stats.keys()) {
        queueTagRevalidate(`ranking:user:${statUserId}`, LIST_CACHE_LIFE);
        revalidateProfileTagsFor(statUserId);
      }
      log.info("league.results_published", {
        eventId: locked.id,
        ranked: ranked.length,
      });
      return response;
    }),
  );
}

async function loadCriteria(
  tx: Tx,
  eventId: string,
): Promise<{ key: string; label: string; weight: number; maxScore: number }[]> {
  const rows = await tx
    .select({
      key: eventScoringCriteria.key,
      label: eventScoringCriteria.label,
      weight: eventScoringCriteria.weight,
      maxScore: eventScoringCriteria.maxScore,
    })
    .from(eventScoringCriteria)
    .where(eq(eventScoringCriteria.eventId, eventId))
    .orderBy(eventScoringCriteria.sortOrder);
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    weight: Number(row.weight),
    maxScore: Number(row.maxScore),
  }));
}

export async function setRunWindow(
  userId: string,
  input: LifecycleMutationInput & {
    runId: string;
    windowMinutes: number;
    mode: "open" | "extend" | "close";
  },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.setRunWindow", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "event.flow");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      if (locked.status !== "live") {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          "Run windows can only be managed while the event is live",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: `${RUN_WINDOW_ACTION}:${input.mode}`,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const [run] = await tx
        .select()
        .from(eventRuns)
        .where(
          and(eq(eventRuns.id, input.runId), eq(eventRuns.eventId, locked.id)),
        )
        .for("update")
        .limit(1);
      if (!run) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Run not found: ${input.runId}`,
        );
      }
      const now = new Date();
      const setValues: Partial<NewEventRunRow> = { updatedAt: now };
      if (input.mode === "open") {
        if (run.status !== "scheduled") {
          throw new LeagueDomainError(
            "INVALID_TRANSITION",
            "Only scheduled runs can open a judging window",
          );
        }
        const minutes = clampWindowMinutes(input.windowMinutes);
        setValues.status = "judging";
        setValues.windowStartedAt = now;
        setValues.windowEndsAt = new Date(now.getTime() + minutes * 60_000);
      } else if (input.mode === "extend") {
        if (run.status !== "judging") {
          throw new LeagueDomainError(
            "INVALID_TRANSITION",
            "Only judging runs can extend their window",
          );
        }
        const minutes = clampWindowMinutes(input.windowMinutes);
        const base = run.windowEndsAt ?? now;
        setValues.windowEndsAt = new Date(
          Math.max(base.getTime(), now.getTime()) + minutes * 60_000,
        );
      } else {
        if (run.status !== "judging") {
          throw new LeagueDomainError(
            "INVALID_TRANSITION",
            "Only judging runs can be closed or marked skipped",
          );
        }
        const [scoreCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(eventScores)
          .where(eq(eventScores.runId, run.id));
        setValues.status =
          Number(scoreCount?.count ?? 0) > 0 ? "scored" : "skipped";
        setValues.windowEndsAt = now;
      }
      await tx.update(eventRuns).set(setValues).where(eq(eventRuns.id, run.id));

      const response = await bumpEventVersion(tx, locked.id, userId);
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: `${RUN_WINDOW_ACTION}:${input.mode}`,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType:
          input.mode === "open" ? "run_started" : "event_state_changed",
      });
      if (input.mode === "close") await notifyIfScoringComplete(tx, locked);
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function submitRunScore(
  userId: string,
  input: LifecycleMutationInput & {
    runId: string;
    scores: Record<string, number>;
    elements?: string[];
    bestTrick?: { difficulty: number; execution: number };
  },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.submitScore", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError(
          "STALE_VERSION",
          "The event changed since you loaded it",
        );
      }
      const role = await loadMembership(tx, locked.id, userId);
      assertCapability(role, "scores.submit");
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      if (locked.status !== "live") {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          "Scores can only be submitted while the event is live",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: SUBMIT_SCORE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;

      const [run] = await tx
        .select()
        .from(eventRuns)
        .where(
          and(eq(eventRuns.id, input.runId), eq(eventRuns.eventId, locked.id)),
        )
        .for("update")
        .limit(1);
      if (!run) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          `Run not found: ${input.runId}`,
        );
      }
      if (locked.submissionMode === "video") {
        // Video runs have no window: judges score any submitted run while
        // the contest is live (revisions allowed until it completes).
        if ((run.status !== "submitted" && run.status !== "scored") || !run.videoUrl) {
          throw new LeagueDomainError(
            "RUN_WINDOW_CLOSED",
            "This run has no video to judge yet",
          );
        }
      } else {
        if (run.status !== "judging") {
          throw new LeagueDomainError(
            "RUN_WINDOW_CLOSED",
            "This run is not in an active judging window",
          );
        }
        if (
          run.windowEndsAt === null ||
          run.windowEndsAt.getTime() < Date.now()
        ) {
          throw new LeagueDomainError(
            "RUN_WINDOW_CLOSED",
            "The judging window has closed",
          );
        }
      }
      const division = (await loadDivisions(tx, locked.id)).find(
        (row) => row.id === run.divisionId,
      );
      let total: number;
      let bestTrick: { difficulty: number; execution: number } | null = null;
      let trickTotal: number | null = null;
      let elements: string[] = [];
      if (!division || division.format === "open" || !isRatingDiscipline(division.disciplineSlug)) {
        const criteria = await loadCriteria(tx, locked.id);
        total = judgeTotal(input.scores, criteria);
      } else {
        total = judgeRunTotal(input.scores);
        elements = assertElementTicks(
          input.elements ?? [],
          elementIdsFor(division.disciplineSlug, division.format),
        );
        if (division.hasBestTrick) {
          if (!input.bestTrick) {
            throw new LeagueDomainError(
              "SCORE_INVALID",
              "Score the best trick too: difficulty and execution",
            );
          }
          trickTotal = bestTrickTotal(input.bestTrick);
          bestTrick = input.bestTrick;
        }
      }
      const scoredAt = new Date();
      await tx
        .insert(eventScores)
        .values({
          eventId: locked.id,
          runId: run.id,
          judgeUserId: userId,
          scores: input.scores,
          total: String(total),
          bestTrick,
          bestTrickTotal: trickTotal === null ? null : String(trickTotal),
          elements,
        })
        .onConflictDoUpdate({
          target: [eventScores.runId, eventScores.judgeUserId],
          set: {
            scores: input.scores,
            total: String(total),
            bestTrick,
            bestTrickTotal: trickTotal === null ? null : String(trickTotal),
            elements,
            updatedAt: scoredAt,
          },
        });
      await tx
        .update(eventRuns)
        .set({
          updatedAt: scoredAt,
          ...(locked.submissionMode === "video" ? { status: "scored" as const } : {}),
        })
        .where(eq(eventRuns.id, run.id));

      const response = await bumpEventVersion(tx, locked.id, userId);
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: SUBMIT_SCORE_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "score_submitted",
      });
      if (locked.submissionMode === "video" && run.status !== "scored") {
        await notifyIfScoringComplete(tx, locked);
      }
      queueEventTags(locked.id);
      return response;
    }),
  );
}

// ---------- rider entries & video submissions (0007) ----------

export async function updateMyEntry(
  userId: string,
  input: LifecycleMutationInput & { entry: LeagueRiderEntry },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.updateEntry", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError("STALE_VERSION", "The event changed since you loaded it");
      }
      const role = await loadMembership(tx, locked.id, userId);
      if (role !== "rider") {
        throw new LeagueDomainError("NOT_AUTHORIZED", "Only riders have an entry");
      }
      if (locked.status !== "draft" && locked.status !== "registration_open") {
        throw new LeagueDomainError(
          "INVALID_TRANSITION",
          "Entries can only change while registration is open",
        );
      }
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: UPDATE_ENTRY_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;
      const [membership] = await tx
        .select({ id: eventMemberships.id })
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, locked.id),
            eq(eventMemberships.userId, userId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .limit(1);
      if (!membership) {
        throw new LeagueDomainError("NOT_AUTHORIZED", "You are not in this contest");
      }
      await writeRiderEntries(tx, locked.id, membership.id, input.entry.divisionIds);
      await tx
        .update(eventMemberships)
        .set({
          ageCategory: input.entry.ageCategory,
          gender: input.entry.gender ?? null,
          riderCity: input.entry.city ?? null,
        })
        .where(eq(eventMemberships.id, membership.id));
      const response = await bumpEventVersion(tx, locked.id, userId);
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: UPDATE_ENTRY_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "registration_changed",
      });
      queueEventTags(locked.id);
      return response;
    }),
  );
}

export async function submitRunVideo(
  userId: string,
  input: LifecycleMutationInput & {
    runId: string;
    videoUrl: string;
    bestTrickVideoUrl?: string;
  },
): Promise<LeagueMutationResponse> {
  const { db } = getDbClient();
  return withDbWrite("league.submitVideo", () =>
    db.transaction(async (tx): Promise<LeagueMutationResponse> => {
      const locked = await lockEvent(tx, input.eventId);
      if (locked.version !== input.expectedVersion) {
        throw new LeagueDomainError("STALE_VERSION", "The event changed since you loaded it");
      }
      const gate = await gateFor(tx, locked, locked.id);
      assertEventWritable(gate);
      const fingerprint = await fingerprintFor({ userId, ...input });
      const replay = await findIdempotentResult(tx, {
        userId,
        action: SUBMIT_VIDEO_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
      });
      if (replay) return replay;
      const [run] = await tx
        .select()
        .from(eventRuns)
        .where(and(eq(eventRuns.id, input.runId), eq(eventRuns.eventId, locked.id)))
        .for("update")
        .limit(1);
      if (!run) {
        throw new LeagueDomainError("INVALID_INPUT", `Run not found: ${input.runId}`);
      }
      assertVideoSubmissionOpen({
        submissionMode: locked.submissionMode,
        eventStatus: locked.status,
        deadline: locked.submissionDeadlineAt,
        now: new Date(),
        runUserId: run.userId,
        userId,
        runStatus: run.status,
      });
      const division = (await loadDivisions(tx, locked.id)).find((row) => row.id === run.divisionId);
      const videoUrl = normalizeVideoUrl(input.videoUrl);
      let bestTrickVideoUrl: string | null = null;
      if (division?.hasBestTrick) {
        if (!input.bestTrickVideoUrl) {
          throw new LeagueDomainError("INVALID_INPUT", "Add your best trick video too");
        }
        bestTrickVideoUrl = normalizeVideoUrl(input.bestTrickVideoUrl);
      }
      const now = new Date();
      await tx
        .update(eventRuns)
        .set({ videoUrl, bestTrickVideoUrl, videoSubmittedAt: now, status: "submitted", updatedAt: now })
        .where(eq(eventRuns.id, run.id));
      const response = await bumpEventVersion(tx, locked.id, userId);
      await recordActionRequest(tx, {
        eventId: locked.id,
        userId,
        action: SUBMIT_VIDEO_ACTION,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        resultingVersion: response.version,
        response,
      });
      await recordEventSignal(tx, {
        eventId: locked.id,
        version: response.version,
        signalType: "event_state_changed",
      });
      const [rider] = await tx
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      const judgeIds = await resolveEventRecipients(tx, {
        eventId: locked.id,
        roles: ["judge"],
        excludeUserIds: [userId],
      });
      await createNotifications(
        tx,
        judgeIds.map((judgeId) => ({
          userId: judgeId,
          type: "league_video_submitted",
          payload: {
            eventId: locked.id,
            eventSlug: locked.slug,
            eventName: locked.name,
            actorName: rider?.displayName ?? undefined,
          },
          eventId: locked.id,
        })),
      );
      queueEventTags(locked.id);
      revalidateProfileTagsFor(userId);
      return response;
    }),
  );
}

// ---------- admin payments queue ----------

export interface LeaguePaymentQueueItem {
  id: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  planSlug: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string | null;
  payerName: string;
  createdAt: string;
  paidAt: string | null;
}

export async function listLeaguePayments(
  input: {
    status?: readonly ("pending" | "paid" | "comped" | "refunded" | "failed")[];
    limit?: number;
  } = {},
): Promise<LeaguePaymentQueueItem[]> {
  const { db } = getDbClient();
  return withDbRead("league.paymentsQueue", () =>
    db.transaction(async (tx): Promise<LeaguePaymentQueueItem[]> => {
      const conditions = [];
      if (input.status && input.status.length > 0) {
        conditions.push(inArray(eventPayments.status, [...input.status]));
      }
      const rows = await tx
        .select({
          id: eventPayments.id,
          eventId: eventPayments.eventId,
          eventName: sportEvents.name,
          eventSlug: sportEvents.slug,
          planSlug: eventPayments.planSlug,
          status: eventPayments.status,
          amountCents: eventPayments.amountCents,
          currency: eventPayments.currency,
          provider: eventPayments.provider,
          providerReference: eventPayments.providerReference,
          payerUserId: eventPayments.payerUserId,
          createdAt: eventPayments.createdAt,
          paidAt: eventPayments.paidAt,
        })
        .from(eventPayments)
        .innerJoin(sportEvents, eq(sportEvents.id, eventPayments.eventId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(eventPayments.createdAt))
        .limit(Math.min(100, Math.max(1, input.limit ?? 50)));
      const payerIds = rows
        .map((row) => row.payerUserId)
        .filter((payerId): payerId is string => payerId !== null);
      const payerRows =
        payerIds.length > 0
          ? await tx
              .select({ id: profiles.id, displayName: profiles.displayName })
              .from(profiles)
              .where(inArray(profiles.id, payerIds))
          : [];
      const namesByPayer = new Map(
        payerRows.map((row) => [row.id, row.displayName] as const),
      );
      return rows.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        eventSlug: row.eventSlug,
        eventName: row.eventName,
        planSlug: row.planSlug,
        status: row.status,
        amountCents: row.amountCents,
        currency: row.currency,
        provider: row.provider,
        providerReference: row.providerReference,
        payerName: row.payerUserId
          ? (namesByPayer.get(row.payerUserId) ??
            `User ${row.payerUserId.slice(0, 6)}`)
          : "—",
        createdAt: row.createdAt.toISOString(),
        paidAt: row.paidAt?.toISOString() ?? null,
      }));
    }, READ_TX_OPTIONS),
  );
}

// ---------- my events ----------

export interface MyLeagueEventItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  planSlug: string;
  timezone: string;
  startDate: string;
  endDate: string | null;
  version: number;
  myRole: EventRole;
  paymentState: PaymentGate["state"];
  paymentDueAt: string | null;
  paymentDeadlineAt: string | null;
}

export async function listMyLeagueEvents(
  userId: string,
): Promise<MyLeagueEventItem[]> {
  const { db } = getDbClient();
  return withDbRead("league.myEvents", () =>
    db.transaction(async (tx): Promise<MyLeagueEventItem[]> => {
      const rows = await tx
        .select({ event: sportEvents, role: eventMemberships.role })
        .from(eventMemberships)
        .innerJoin(sportEvents, eq(sportEvents.id, eventMemberships.eventId))
        .where(
          and(
            eq(eventMemberships.userId, userId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .orderBy(sportEvents.startAt);
      if (rows.length === 0) return [];

      const eventIds = rows.map((row) => row.event.id);
      const activePayments = await tx
        .select({ eventId: eventPayments.eventId })
        .from(eventPayments)
        .where(
          and(
            inArray(eventPayments.eventId, eventIds),
            inArray(eventPayments.status, ["paid", "comped"]),
          ),
        );
      const paidEventIds = new Set(activePayments.map((row) => row.eventId));

      return rows.map((row) => {
        const event = row.event;
        const gate = paymentGate({
          createdAt: event.createdAt,
          hasActivePayment: paidEventIds.has(event.id),
          now: new Date(),
        });
        return {
          id: event.id,
          slug: event.slug,
          name: event.name,
          status: event.status,
          planSlug: event.planSlug,
          timezone: event.timezone,
          startDate: event.startAt.toISOString().slice(0, 10),
          endDate: event.endAt ? event.endAt.toISOString().slice(0, 10) : null,
          version: event.version,
          myRole: row.role,
          paymentState: gate.state,
          paymentDueAt: gate.paymentDueAt?.toISOString() ?? null,
          paymentDeadlineAt: gate.paymentDeadlineAt?.toISOString() ?? null,
        };
      });
    }, READ_TX_OPTIONS),
  );
}

// ---------- quota / lookups ----------

interface AccountPlan {
  slug: string;
  monthlyEventLimit: number;
}

async function accountPlan(tx: Tx, userId: string): Promise<AccountPlan> {
  const [userPlan] = await tx
    .select({ planSlug: userEventPlans.planSlug })
    .from(userEventPlans)
    .where(
      and(
        eq(userEventPlans.userId, userId),
        eq(userEventPlans.status, "active"),
      ),
    )
    .limit(1);
  const slug = userPlan?.planSlug ?? FREE_PLAN_SLUG;
  const [plan] = await tx
    .select({ monthlyEventLimit: eventPlans.monthlyEventLimit })
    .from(eventPlans)
    .where(eq(eventPlans.slug, slug))
    .limit(1);
  return { slug, monthlyEventLimit: plan?.monthlyEventLimit ?? 8 };
}

async function countContestsThisMonth(
  tx: Tx,
  userId: string,
  now: Date,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(sportEvents)
    .where(
      and(
        eq(sportEvents.createdBy, userId),
        gte(sportEvents.createdAt, startOfUtcMonth(now)),
      ),
    );
  return Number(row?.count ?? 0);
}

async function resolveCountryCode(
  tx: Tx,
  country: string,
  countryCode?: string,
): Promise<string | null> {
  if (countryCode) {
    const [row] = await tx
      .select({ iso2: countries.iso2 })
      .from(countries)
      .where(eq(countries.iso2, countryCode.toUpperCase()))
      .limit(1);
    return row?.iso2 ?? null;
  }
  const [row] = await tx
    .select({ iso2: countries.iso2 })
    .from(countries)
    .where(eq(countries.name, country))
    .limit(1);
  return row?.iso2 ?? null;
}

// ---------- dashboard / history ----------

export interface LeagueJudgeProgress {
  judgeUserId: string;
  judgeName: string;
  scoresSubmitted: number;
}

export interface LeagueCriterionAverage {
  key: string;
  label: string;
  average: number;
  maxScore: number;
}

export interface LeagueDashboard {
  eventStatus: string;
  counts: { riders: number; judges: number; organizers: number };
  runs: { total: number; scored: number; skipped: number; judging: number };
  judges: LeagueJudgeProgress[];
  criteria: LeagueCriterionAverage[];
  payment: { state: PaymentGate["state"]; planSlug: string };
  /** PAID_FEATURES.historic_metrics — true for paid (non-free) plans. */
  historicMetrics: boolean;
}

/** Organizer-only live + historic metrics for the manage console. */
export async function getLeagueEventDashboard(
  eventId: string,
  viewerId: string,
): Promise<LeagueDashboard | null> {
  const { db } = getDbClient();
  return withDbRead("league.dashboard", () =>
    db.transaction(async (tx): Promise<LeagueDashboard | null> => {
      const [event] = await tx
        .select()
        .from(sportEvents)
        .where(eq(sportEvents.id, eventId))
        .limit(1);
      if (!event) return null;
      const [membership] = await tx
        .select({ role: eventMemberships.role })
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, eventId),
            eq(eventMemberships.userId, viewerId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .limit(1);
      const role = membership?.role ?? null;
      if (role !== "main_organizer" && role !== "organizer") return null;

      const countRows = await tx
        .select({
          role: eventMemberships.role,
          count: sql<number>`count(*)::int`,
        })
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, eventId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .groupBy(eventMemberships.role);
      const counts = { riders: 0, judges: 0, organizers: 0 };
      for (const row of countRows) {
        if (row.role === "rider") counts.riders = Number(row.count);
        else if (row.role === "judge") counts.judges = Number(row.count);
        else counts.organizers += Number(row.count);
      }

      const runRows = await tx
        .select({ status: eventRuns.status, count: sql<number>`count(*)::int` })
        .from(eventRuns)
        .where(eq(eventRuns.eventId, eventId))
        .groupBy(eventRuns.status);
      const runs = { total: 0, scored: 0, skipped: 0, judging: 0 };
      for (const row of runRows) {
        const count = Number(row.count);
        runs.total += count;
        if (row.status === "scored") runs.scored += count;
        else if (row.status === "skipped") runs.skipped += count;
        else if (row.status === "judging") runs.judging += count;
      }

      const scoreRows = await tx
        .select({
          judgeUserId: eventScores.judgeUserId,
          judgeName: profiles.displayName,
          scores: eventScores.scores,
        })
        .from(eventScores)
        .leftJoin(profiles, eq(profiles.id, eventScores.judgeUserId))
        .where(eq(eventScores.eventId, eventId));

      const judgesMap = new Map<string, LeagueJudgeProgress>();
      for (const row of scoreRows) {
        const key = row.judgeUserId;
        const entry = judgesMap.get(key);
        if (entry) {
          entry.scoresSubmitted += 1;
        } else {
          judgesMap.set(key, {
            judgeUserId: key,
            judgeName: row.judgeName ?? `Judge ${key.slice(0, 6)}`,
            scoresSubmitted: 1,
          });
        }
      }

      const criteriaRows = await tx
        .select()
        .from(eventScoringCriteria)
        .where(eq(eventScoringCriteria.eventId, eventId))
        .orderBy(eventScoringCriteria.sortOrder);
      const sums = new Map<string, { sum: number; count: number }>();
      for (const row of scoreRows) {
        for (const [key, value] of Object.entries(row.scores ?? {})) {
          const entry = sums.get(key) ?? { sum: 0, count: 0 };
          entry.sum += Number(value);
          entry.count += 1;
          sums.set(key, entry);
        }
      }
      const criteria = criteriaRows.map((criterion) => {
        const entry = sums.get(criterion.key);
        return {
          key: criterion.key,
          label: criterion.label,
          average: entry && entry.count > 0 ? entry.sum / entry.count : 0,
          maxScore: Number(criterion.maxScore),
        };
      });

      const [activePayment] = await tx
        .select({ status: eventPayments.status })
        .from(eventPayments)
        .where(
          and(
            eq(eventPayments.eventId, eventId),
            inArray(eventPayments.status, ["paid", "comped"]),
          ),
        )
        .limit(1);
      const gate = paymentGate({
        createdAt: event.createdAt,
        hasActivePayment: Boolean(activePayment),
        now: new Date(),
      });

      return {
        eventStatus: event.status,
        counts,
        runs,
        judges: [...judgesMap.values()].sort(
          (a, b) =>
            b.scoresSubmitted - a.scoresSubmitted ||
            a.judgeName.localeCompare(b.judgeName),
        ),
        criteria,
        payment: { state: gate.state, planSlug: event.planSlug },
        // PAID_FEATURES.historic_metrics: the historic slice is plan-gated;
        // live metrics above stay available to every plan.
        historicMetrics: event.planSlug !== FREE_PLAN_SLUG,
      };
    }, READ_TX_OPTIONS),
  );
}

export interface MyEventHistory {
  eventStatus: string;
  myRole: EventRole;
  /** Rider: my runs in order. */
  myRuns: {
    runId: string;
    sequence: number;
    riderName: string;
    status: string;
    windowEndsAt: string | null;
    myTotal: number | null;
  }[];
  /** Rider: published result, when results are frozen. */
  result: {
    rank: number;
    totalScore: number;
    pointsAwarded: number;
  } | null;
  /** Judge: submissions I authored. */
  myJudgements: {
    runId: string;
    sequence: number;
    riderName: string;
    total: number;
  }[];
}

/**
 * Per-event history for the signed-in member (spec `GET /history`): riders
 * see their runs + published result, judges see their submissions,
 * organizers get a light summary. Non-members resolve to null (404).
 */
export async function getMyEventHistory(
  eventId: string,
  userId: string,
): Promise<MyEventHistory | null> {
  const { db } = getDbClient();
  return withDbRead("league.myHistory", () =>
    db.transaction(async (tx): Promise<MyEventHistory | null> => {
      const [membership] = await tx
        .select({
          role: eventMemberships.role,
          eventStatus: sportEvents.status,
        })
        .from(eventMemberships)
        .innerJoin(sportEvents, eq(sportEvents.id, eventMemberships.eventId))
        .where(
          and(
            eq(eventMemberships.eventId, eventId),
            eq(eventMemberships.userId, userId),
            eq(eventMemberships.status, "active"),
          ),
        )
        .limit(1);
      if (!membership) return null;
      const role = membership.role;

      const runRows = await tx
        .select({
          id: eventRuns.id,
          sequence: eventRuns.sequence,
          riderUserId: eventRuns.userId,
          riderName: profiles.displayName,
          status: eventRuns.status,
          windowEndsAt: eventRuns.windowEndsAt,
        })
        .from(eventRuns)
        .leftJoin(profiles, eq(profiles.id, eventRuns.userId))
        .where(eq(eventRuns.eventId, eventId))
        .orderBy(eventRuns.sequence);
      const scoreRows = await tx
        .select({
          runId: eventScores.runId,
          judgeUserId: eventScores.judgeUserId,
          total: eventScores.total,
        })
        .from(eventScores)
        .where(eq(eventScores.eventId, eventId));
      const totalsByRun = new Map<string, number[]>();
      for (const row of scoreRows) {
        const list = totalsByRun.get(row.runId) ?? [];
        list.push(Number(row.total));
        totalsByRun.set(row.runId, list);
      }

      const rider =
        role === "rider" || role === "main_organizer" || role === "organizer";
      const judge =
        role === "judge" || role === "main_organizer" || role === "organizer";
      const riderNameFor = (row: (typeof runRows)[number]) =>
        row.riderName ?? `Rider ${row.riderUserId.slice(0, 6)}`;

      const [result] = rider
        ? await tx
            .select({
              rank: eventResults.rank,
              totalScore: eventResults.totalScore,
              pointsAwarded: eventResults.pointsAwarded,
            })
            .from(eventResults)
            .where(
              and(
                eq(eventResults.eventId, eventId),
                eq(eventResults.userId, userId),
              ),
            )
            .limit(1)
        : [];

      return {
        eventStatus: membership.eventStatus,
        myRole: role,
        myRuns: rider
          ? runRows
              .filter((row) => row.riderUserId === userId)
              .map((row) => {
                const totals = totalsByRun.get(row.id) ?? [];
                return {
                  runId: row.id,
                  sequence: row.sequence,
                  riderName: riderNameFor(row),
                  status: row.status,
                  windowEndsAt: row.windowEndsAt?.toISOString() ?? null,
                  myTotal:
                    totals.length > 0
                      ? totals.reduce((sum, value) => sum + value, 0) /
                        totals.length
                      : null,
                };
              })
          : [],
        result: result
          ? {
              rank: result.rank,
              totalScore: Number(result.totalScore),
              pointsAwarded: result.pointsAwarded,
            }
          : null,
        myJudgements: judge
          ? scoreRows
              .filter((row) => row.judgeUserId === userId)
              .map((row) => {
                const run = runRows.find(
                  (candidate) => candidate.id === row.runId,
                );
                return {
                  runId: row.runId,
                  sequence: run?.sequence ?? 0,
                  riderName: run ? riderNameFor(run) : "—",
                  total: Number(row.total),
                };
              })
              .sort((a, b) => a.sequence - b.sequence)
          : [],
      };
    }, READ_TX_OPTIONS),
  );
}

/** Slug → {eventId} + history in one call for public/member detail pages. */
export async function getMyEventHistoryBySlug(
  slug: string,
  userId: string,
): Promise<MyEventHistory | null> {
  const resolved = await resolveLeagueEventIdBySlug(slug);
  if (!resolved) return null;
  return getMyEventHistory(resolved.id, userId);
}

export interface ContestDetail {
  contest: ContestEnriched;
  /** The viewer's own activity; null for guests and non-members. */
  history: MyEventHistory | null;
}

/**
 * Contest detail for `/league/[slug]`. Public contests render for everyone
 * (cached public read). Unlisted contests — every free-plan contest, shared
 * by QR code — render only for active members; everyone else gets null (404).
 */
export async function getContestDetailBySlug(
  slug: string,
  viewerId: string | null,
): Promise<ContestDetail | null> {
  const [publicContest, history] = await Promise.all([
    findEventBySlug(slug),
    viewerId ? getMyEventHistoryBySlug(slug, viewerId) : Promise.resolve(null),
  ]);
  if (publicContest) return { contest: publicContest, history };
  if (!history) return null;
  const resolved = await resolveLeagueEventIdBySlug(slug);
  if (!resolved) return null;
  const contest = await runFindEventById(resolved.id);
  return contest ? { contest, history } : null;
}

// ---------- curation ----------

export interface ContestCurationQuery {
  /** Name search (case-insensitive substring). */
  q?: string;
  planSlug?: string;
  visibility?: "public" | "unlisted";
  status?: string;
  countryCode?: string;
  featured?: boolean;
}

export interface ContestCurationItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  planSlug: string;
  visibility: string;
  featured: boolean;
  countryCode: string;
  countryName: string;
  city: string;
  startDate: string;
  createdAt: string;
  version: number;
  /** Active paid/comped payment exists (gate settled). */
  settled: boolean;
}

export const CONTEST_CURATION_LIMIT = 200;

/**
 * Contest table for the admin curation section. `countryCodes` is the
 * curator's scope (null = every country, for admins and legacy curators);
 * every plan, visibility and status is included.
 */
export async function listContestsForCuration(
  countryCodes: readonly string[] | null,
  query: ContestCurationQuery = {},
): Promise<ContestCurationItem[]> {
  if (countryCodes !== null && countryCodes.length === 0) return [];
  const { db } = getDbClient();
  const conditions: SQL[] = [];
  if (countryCodes !== null) {
    conditions.push(inArray(sportEvents.countryCode, [...countryCodes]));
  }
  if (query.q?.trim()) {
    conditions.push(ilike(sportEvents.name, `%${query.q.trim().replace(/[%_\\]/g, "\\$&")}%`));
  }
  if (query.planSlug) conditions.push(eq(sportEvents.planSlug, query.planSlug));
  if (query.visibility) conditions.push(eq(sportEvents.visibility, query.visibility));
  if (query.status) {
    conditions.push(eq(sportEvents.status, query.status as EventStatus));
  }
  if (query.countryCode) {
    conditions.push(eq(sportEvents.countryCode, query.countryCode.toUpperCase()));
  }
  if (query.featured !== undefined) {
    conditions.push(eq(sportEvents.featured, query.featured));
  }
  const settled = sql<boolean>`exists (
    select 1 from ${eventPayments}
    where ${eventPayments.eventId} = ${sportEvents.id}
      and ${eventPayments.status} in ('paid', 'comped')
  )`;
  const rows = await withDbRead("league.curationList", () =>
    db
      .select({
        id: sportEvents.id,
        slug: sportEvents.slug,
        name: sportEvents.name,
        status: sportEvents.status,
        planSlug: sportEvents.planSlug,
        visibility: sportEvents.visibility,
        featured: sportEvents.featured,
        countryCode: sportEvents.countryCode,
        countryName: countries.name,
        city: sportEvents.city,
        startAt: sportEvents.startAt,
        createdAt: sportEvents.createdAt,
        version: sportEvents.version,
        settled,
      })
      .from(sportEvents)
      .innerJoin(countries, eq(countries.iso2, sportEvents.countryCode))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sportEvents.createdAt))
      .limit(CONTEST_CURATION_LIMIT),
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    planSlug: row.planSlug,
    visibility: row.visibility,
    featured: row.featured,
    countryCode: row.countryCode,
    countryName: row.countryName,
    city: row.city,
    startDate: row.startAt.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    version: row.version,
    settled: Boolean(row.settled),
  }));
}

/** Curator view of one contest: the full state, without needing membership. */
export async function getContestForCuration(
  eventId: string,
  curatorId: string,
): Promise<LeagueEventState | null> {
  return getLeagueEventState(eventId, curatorId, { asCurator: true });
}

/** Country of a contest — routes resolve it to check the curator scope. */
export async function getContestCountryCode(
  eventId: string,
): Promise<string | null> {
  const { db } = getDbClient();
  const [row] = await withDbRead("league.contestCountry", () =>
    db
      .select({ countryCode: sportEvents.countryCode })
      .from(sportEvents)
      .where(eq(sportEvents.id, eventId))
      .limit(1),
  );
  return row?.countryCode ?? null;
}

// ---------- admin plans ----------

export interface LeaguePlanItem {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  maxRiders: number;
  maxJudges: number;
  maxOrganizers: number;
  monthlyEventLimit: number;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
}

export async function listEventPlans(): Promise<LeaguePlanItem[]> {
  const { db } = getDbClient();
  return withDbRead("league.listPlans", () =>
    db.transaction(async (tx): Promise<LeaguePlanItem[]> => {
      const rows = await tx
        .select()
        .from(eventPlans)
        .orderBy(eventPlans.sortOrder, eventPlans.slug);
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        priceCents: row.priceCents,
        currency: row.currency,
        maxRiders: row.maxRiders,
        maxJudges: row.maxJudges,
        maxOrganizers: row.maxOrganizers,
        monthlyEventLimit: row.monthlyEventLimit,
        isDefault: row.isDefault,
        active: row.active,
        sortOrder: row.sortOrder,
      }));
    }, READ_TX_OPTIONS),
  );
}

export interface LeaguePlanPatch {
  name?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  maxRiders?: number;
  maxJudges?: number;
  maxOrganizers?: number;
  monthlyEventLimit?: number;
  isDefault?: boolean;
  active?: boolean;
  sortOrder?: number;
}

/**
 * Create a plan row (new pricing tiers ship as new slugs: `event_payments`
 * and `user_event_plans` RESTRICT-reference the slug, so existing slugs are
 * edit-only). `isDefault` is exclusive — setting it clears the previous
 * default in the same transaction.
 */
export async function createEventPlan(
  actorId: string,
  input: { slug: string } & LeaguePlanPatch,
): Promise<LeaguePlanItem> {
  const { slug, ...patch } = input;
  const { db } = getDbClient();
  return withDbWrite("league.createPlan", () =>
    db.transaction(async (tx): Promise<LeaguePlanItem> => {
      if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
        throw new LeagueDomainError(
          "INVALID_INPUT",
          "Plan slug must be 2-41 lowercase letters, digits or dashes",
        );
      }
      const [existing] = await tx
        .select({ slug: eventPlans.slug })
        .from(eventPlans)
        .where(eq(eventPlans.slug, slug))
        .limit(1);
      if (existing) {
        throw new LeagueDomainError(
          "PLAN_EXISTS",
          `Plan already exists: ${slug}`,
        );
      }
      if (patch.isDefault) {
        await tx
          .update(eventPlans)
          .set({ isDefault: false })
          .where(eq(eventPlans.isDefault, true));
      }
      const [row] = await tx
        .insert(eventPlans)
        .values({
          slug,
          name: patch.name ?? slug,
          description: patch.description ?? "",
          priceCents: patch.priceCents ?? 0,
          currency: patch.currency ?? "USD",
          maxRiders: patch.maxRiders ?? 3,
          maxJudges: patch.maxJudges ?? 0,
          maxOrganizers: patch.maxOrganizers ?? 1,
          monthlyEventLimit: patch.monthlyEventLimit ?? 8,
          isDefault: patch.isDefault ?? false,
          active: patch.active ?? true,
          sortOrder: patch.sortOrder ?? 100,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      if (!row) {
        throw new LeagueDomainError("INVALID_INPUT", "Plan insert failed");
      }
      return {
        slug: row.slug,
        name: row.name,
        description: row.description,
        priceCents: row.priceCents,
        currency: row.currency,
        maxRiders: row.maxRiders,
        maxJudges: row.maxJudges,
        maxOrganizers: row.maxOrganizers,
        monthlyEventLimit: row.monthlyEventLimit,
        isDefault: row.isDefault,
        active: row.active,
        sortOrder: row.sortOrder,
      };
    }),
  );
}

/** Edit-only plan patch (slug immutable; see createEventPlan). */
export async function updateEventPlan(
  actorId: string,
  slug: string,
  patch: LeaguePlanPatch,
): Promise<LeaguePlanItem> {
  const { db } = getDbClient();
  return withDbWrite("league.updatePlan", () =>
    db.transaction(async (tx): Promise<LeaguePlanItem> => {
      if (patch.isDefault === true) {
        await tx
          .update(eventPlans)
          .set({ isDefault: false })
          .where(eq(eventPlans.isDefault, true));
      }
      const [row] = await tx
        .update(eventPlans)
        .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(eventPlans.slug, slug))
        .returning();
      if (!row) {
        throw new LeagueDomainError(
          "PLAN_NOT_FOUND",
          `Plan not found: ${slug}`,
        );
      }
      return {
        slug: row.slug,
        name: row.name,
        description: row.description,
        priceCents: row.priceCents,
        currency: row.currency,
        maxRiders: row.maxRiders,
        maxJudges: row.maxJudges,
        maxOrganizers: row.maxOrganizers,
        monthlyEventLimit: row.monthlyEventLimit,
        isDefault: row.isDefault,
        active: row.active,
        sortOrder: row.sortOrder,
      };
    }),
  );
}

export interface LeagueAccountPlanItem {
  userId: string;
  displayName: string;
  email: string;
  planSlug: string;
  source: string;
  status: string;
  grantedAt: string;
}

/** Account-plan grants with user context; optional email/name search. */
export async function listAccountPlans(
  input: { search?: string; limit?: number } = {},
): Promise<LeagueAccountPlanItem[]> {
  const { db } = getDbClient();
  return withDbRead("league.listAccountPlans", () =>
    db.transaction(async (tx): Promise<LeagueAccountPlanItem[]> => {
      const search = input.search?.trim();
      const conditions = [];
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          sql`(lower(${authUsers.email}) like lower(${pattern}) or lower(${profiles.displayName}) like lower(${pattern}))`,
        );
      }
      const rows = await tx
        .select({
          userId: userEventPlans.userId,
          displayName: profiles.displayName,
          email: authUsers.email,
          planSlug: userEventPlans.planSlug,
          source: userEventPlans.source,
          status: userEventPlans.status,
          grantedAt: userEventPlans.grantedAt,
        })
        .from(userEventPlans)
        .innerJoin(authUsers, eq(authUsers.id, userEventPlans.userId))
        .leftJoin(profiles, eq(profiles.id, userEventPlans.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(userEventPlans.grantedAt))
        .limit(Math.min(100, Math.max(1, input.limit ?? 50)));
      return rows.map((row) => ({
        userId: row.userId,
        displayName: row.displayName ?? `User ${row.userId.slice(0, 6)}`,
        email: row.email ?? "",
        planSlug: row.planSlug,
        source: row.source,
        status: row.status,
        grantedAt: row.grantedAt.toISOString(),
      }));
    }, READ_TX_OPTIONS),
  );
}

/** Grant or switch a user's account plan (source admin_grant). */
export async function grantAccountPlan(
  actorId: string,
  input: { userId: string; planSlug: string },
): Promise<LeagueAccountPlanItem> {
  const { db } = getDbClient();
  return withDbWrite("league.grantAccountPlan", () =>
    db.transaction(async (tx): Promise<LeagueAccountPlanItem> => {
      const [user] = await tx
        .select({
          id: authUsers.id,
          email: authUsers.email,
          displayName: profiles.displayName,
        })
        .from(authUsers)
        .leftJoin(profiles, eq(profiles.id, authUsers.id))
        .where(eq(authUsers.id, input.userId))
        .limit(1);
      if (!user) {
        throw new LeagueDomainError("USER_NOT_FOUND", "User not found");
      }
      const [plan] = await tx
        .select({ slug: eventPlans.slug })
        .from(eventPlans)
        .where(eq(eventPlans.slug, input.planSlug))
        .limit(1);
      if (!plan) {
        throw new LeagueDomainError(
          "PLAN_NOT_FOUND",
          `Plan not found: ${input.planSlug}`,
        );
      }
      const grantedRows = await tx
        .insert(userEventPlans)
        .values({
          userId: input.userId,
          planSlug: input.planSlug,
          source: "admin_grant",
          status: "active",
          grantedBy: actorId,
        })
        .onConflictDoUpdate({
          target: userEventPlans.userId,
          set: {
            planSlug: input.planSlug,
            source: "admin_grant",
            status: "active",
            grantedBy: actorId,
            updatedAt: new Date(),
          },
        })
        .returning({ grantedAt: userEventPlans.grantedAt });
      const grantedAt = grantedRows[0];
      if (!grantedAt) {
        throw new LeagueDomainError("INVALID_INPUT", "Plan grant failed");
      }
      return {
        userId: input.userId,
        displayName: user.displayName ?? `User ${input.userId.slice(0, 6)}`,
        email: user.email ?? "",
        planSlug: input.planSlug,
        source: "admin_grant",
        status: "active",
        grantedAt: grantedAt.grantedAt.toISOString(),
      };
    }),
  );
}

/** Revoke a user's account plan (they fall back to the default/free caps). */
export async function revokeAccountPlan(
  userId: string,
): Promise<{ userId: string; status: "revoked" }> {
  const { db } = getDbClient();
  return withDbWrite("league.revokeAccountPlan", () =>
    db.transaction(async (tx) => {
      await tx
        .update(userEventPlans)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(userEventPlans.userId, userId));
      return { userId, status: "revoked" as const };
    }),
  );
}

// ---------- misc ----------

function dateAtUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}
