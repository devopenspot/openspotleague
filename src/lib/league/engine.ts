/**
 * League engine — the pure domain core of the league section. No DB, no IO.
 * The service layer rehydrates rows, applies these functions, and persists;
 * every rule here is unit-tested (src/lib/league/engine.test.ts).
 */

import {
  ATTENDANCE_POINTS,
  DEFAULT_SCORING_CRITERIA,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_WINDOW_MINUTES,
  LeagueDomainError,
  MAX_SCHEDULE_ADVANCE_MONTHS,
  MAX_SLOT_MINUTES,
  MAX_WINDOW_MINUTES,
  MIN_SLOT_MINUTES,
  MIN_WINDOW_MINUTES,
  PAYMENT_DISABLE_AFTER_DAYS,
  PAYMENT_LOCK_AFTER_DAYS,
  rankBonusPoints,
  type EventRole,
  type EventStatus,
  type PaymentGateState,
  type PlanCaps,
  type ScoringCriterionDefinition,
} from "./definitions";

// ---------- payment gate ----------

export interface PaymentGateInput {
  /** Editorial events have no payment deadlines and are always settled. */
  origin: "seed" | "community";
  createdAt: Date;
  hasActivePayment: boolean;
  now: Date;
}

export interface PaymentGate {
  state: PaymentGateState;
  /** When the event locks (read-only). Null for editorial events. */
  paymentDueAt: Date | null;
  /** When the event is disabled definitively. Null for editorial events. */
  paymentDeadlineAt: Date | null;
}

/**
 * Lazy evaluation of the payment gate — computed from `created_at` and the
 * presence of an active payment. No background jobs: the state is derived on
 * every read and enforced on every write. Once the final deadline passes
 * without a payment, the state is stable forever because payment
 * registration is rejected past that point.
 */
export function paymentGate(input: PaymentGateInput): PaymentGate {
  if (input.origin === "seed" || input.hasActivePayment) {
    return { state: "settled", paymentDueAt: null, paymentDeadlineAt: null };
  }
  const due = addDays(input.createdAt, PAYMENT_LOCK_AFTER_DAYS);
  const deadline = addDays(input.createdAt, PAYMENT_DISABLE_AFTER_DAYS);
  if (input.now.getTime() >= deadline.getTime()) {
    return { state: "disabled", paymentDueAt: due, paymentDeadlineAt: deadline };
  }
  if (input.now.getTime() >= due.getTime()) {
    return { state: "locked", paymentDueAt: due, paymentDeadlineAt: deadline };
  }
  return { state: "pending", paymentDueAt: due, paymentDeadlineAt: deadline };
}

export interface PaymentGateError {
  code: "EVENT_LOCKED" | "EVENT_DISABLED";
}

/**
 * Throws for locked/disabled events — every mutation except payment
 * registration must call this. Reads never throw.
 */
export function assertEventWritable(gate: PaymentGate): void {
  if (gate.state === "locked") {
    throw new LeagueDomainError(
      "EVENT_LOCKED",
      "Payment required to move forward: the event is read-only until a payment is registered",
    );
  }
  if (gate.state === "disabled") {
    throw new LeagueDomainError(
      "EVENT_DISABLED",
      "This event was disabled definitively because no payment was registered in time",
    );
  }
}

/** Payment registration is possible while pending or locked, never disabled. */
export function assertPaymentWindowOpen(gate: PaymentGate): void {
  if (gate.state === "disabled") {
    throw new LeagueDomainError(
      "EVENT_DISABLED",
      "This event was disabled definitively because no payment was registered in time",
    );
  }
}

// ---------- scheduling advance window ----------

/**
 * A community event may be scheduled at most two months in advance. Applied
 * at creation and whenever the start date changes.
 */
export function assertScheduleAdvanceWindow(startAt: Date, now: Date): void {
  if (startAt.getTime() > addMonths(now, MAX_SCHEDULE_ADVANCE_MONTHS).getTime()) {
    throw new LeagueDomainError(
      "SCHEDULE_TOO_FAR_AHEAD",
      `Events can be scheduled at most ${MAX_SCHEDULE_ADVANCE_MONTHS} months in advance`,
    );
  }
}

/** The latest start date a community event may have, relative to `now`. */
export function maxScheduleDate(now: Date): Date {
  return addMonths(now, MAX_SCHEDULE_ADVANCE_MONTHS);
}

// ---------- calendar date range ----------

/**
 * League-owned date-range validation: unlike the shared sport-events helper
 * (which throws a plain Error the route layer cannot classify), this maps to
 * the typed 400 INVALID_INPUT contract.
 */
export function assertValidLeagueDateRange(
  startDate: string,
  endDate?: string | null,
): void {
  if (endDate !== undefined && endDate !== null && endDate < startDate) {
    throw new LeagueDomainError(
      "INVALID_INPUT",
      "Event end date must be on or after the start date",
    );
  }
}

// ---------- criteria ----------

export function buildDefaultCriteria(): ScoringCriterionDefinition[] {
  return DEFAULT_SCORING_CRITERIA.map((criterion) => ({ ...criterion }));
}

/**
 * Validates a submitted score object against the event's active criteria:
 * every criterion must be present, finite, and within [0, maxScore].
 * Returns the weighted judge total (2 decimals).
 */
export function judgeTotal(
  scores: Readonly<Record<string, number>>,
  criteria: readonly ScoringCriterionDefinition[],
): number {
  let weighted = 0;
  let weightSum = 0;
  for (const criterion of criteria) {
    const value = scores[criterion.key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new LeagueDomainError(
        "SCORE_INVALID",
        `Missing or invalid score for criterion "${criterion.key}"`,
      );
    }
    if (value < 0 || value > criterion.maxScore) {
      throw new LeagueDomainError(
        "SCORE_INVALID",
        `Score for "${criterion.key}" must be between 0 and ${criterion.maxScore}`,
      );
    }
    weighted += value * criterion.weight;
    weightSum += criterion.weight;
  }
  if (weightSum <= 0) {
    throw new LeagueDomainError("SCORE_INVALID", "Criteria weights must sum above zero");
  }
  return round2(weighted / weightSum);
}

/** Run total = mean of the submitted judge totals (2 decimals). */
export function runTotal(judgeTotals: readonly number[]): number {
  if (judgeTotals.length === 0) {
    throw new LeagueDomainError("NOT_SCORED", "No judge scores were submitted for this run");
  }
  const sum = judgeTotals.reduce((acc, value) => acc + value, 0);
  return round2(sum / judgeTotals.length);
}

// ---------- ranking & points ----------

export interface RankableRun {
  runId: string;
  total: number;
  /** Best single judge total — first tie-breaker. */
  bestJudgeTotal: number;
  /** Lower sequence wins — final tie-breaker. */
  sequence: number;
}

export interface RankedRun extends RankableRun {
  rank: number;
}

/**
 * Ranks scored runs: total desc → best judge total desc → lower sequence.
 * Ranks are distinct (1..N).
 */
export function rankRuns(runs: readonly RankableRun[]): RankedRun[] {
  const ordered = [...runs].sort(
    (a, b) =>
      b.total - a.total ||
      b.bestJudgeTotal - a.bestJudgeTotal ||
      a.sequence - b.sequence,
  );
  return ordered.map((run, index) => ({ ...run, rank: index + 1 }));
}

/** Total points a rider earns for a given final rank (attendance + bonus). */
export function pointsForRank(rank: number): number {
  return ATTENDANCE_POINTS + rankBonusPoints(rank);
}

export function ledgerEventKey(
  eventId: string,
  userId: string,
  kind: "attended" | "rank",
): string {
  return `event:${eventId}:rider:${userId}:${kind}`;
}

// ---------- schedule ----------

export interface PlannedRun {
  membershipId: string;
  sequence: number;
  scheduledAt: Date | null;
}

/**
 * Builds the run schedule for the active riders (already ordered by join
 * time): `scheduled_at = start_at + (sequence-1) × slotMinutes`.
 */
export function buildSchedule(input: {
  riderMembershipIds: readonly string[];
  startAt: Date;
  slotMinutes?: number;
}): PlannedRun[] {
  if (input.riderMembershipIds.length === 0) {
    throw new LeagueDomainError("EMPTY_SCHEDULE", "No active riders to schedule");
  }
  const slotMinutes = clampSlotMinutes(input.slotMinutes ?? DEFAULT_SLOT_MINUTES);
  const slotMs = slotMinutes * 60_000;
  return input.riderMembershipIds.map((membershipId, index) => ({
    membershipId,
    sequence: index + 1,
    scheduledAt: new Date(input.startAt.getTime() + index * slotMs),
  }));
}

export function clampSlotMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SLOT_MINUTES;
  return Math.min(MAX_SLOT_MINUTES, Math.max(MIN_SLOT_MINUTES, Math.trunc(value)));
}

// ---------- schedule reorder ----------

/**
 * Reorder eligibility (engine spec): full reorder while `scheduled`; while
 * `live` only until judging has started (moving runs renumbers every run, so
 * partial judging freezes the order).
 */
export function assertScheduleReorderable(
  eventStatus: EventStatus,
  runStatuses: readonly string[],
): void {
  if (eventStatus === "scheduled") return;
  if (
    eventStatus === "live" &&
    runStatuses.every((status) => status === "scheduled")
  ) {
    return;
  }
  throw new LeagueDomainError(
    "INVALID_TRANSITION",
    "Runs can only be reordered before judging starts",
  );
}

/**
 * Rescheduled slots over an explicit run order — same math as `buildSchedule`
 * (`scheduled_at = start_at + (sequence-1) × slotMinutes`) but driven by the
 * explicit per-run sequence instead of array position.
 */
export function buildRescheduledSlots(input: {
  runs: readonly { runId: string; sequence: number }[];
  startAt: Date;
  slotMinutes?: number;
}): { runId: string; sequence: number; scheduledAt: Date }[] {
  const slotMinutes = clampSlotMinutes(
    input.slotMinutes ?? DEFAULT_SLOT_MINUTES,
  );
  const slotMs = slotMinutes * 60_000;
  return input.runs.map(({ runId, sequence }) => ({
    runId,
    sequence,
    scheduledAt: new Date(input.startAt.getTime() + (sequence - 1) * slotMs),
  }));
}

export function clampWindowMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WINDOW_MINUTES;
  return Math.min(MAX_WINDOW_MINUTES, Math.max(MIN_WINDOW_MINUTES, Math.trunc(value)));
}

// ---------- roles / capabilities ----------

export type EventCapability =
  | "config.edit"
  | "members.manage"
  | "members.remove"
  | "event.cancel"
  | "event.flow"
  | "scores.submit"
  | "dashboard.view";

const CAPABILITIES: Readonly<Record<EventRole, readonly EventCapability[]>> = {
  main_organizer: [
    "config.edit",
    "members.manage",
    "members.remove",
    "event.cancel",
    "event.flow",
    "scores.submit",
    "dashboard.view",
  ],
  organizer: ["config.edit", "members.manage", "event.flow", "scores.submit", "dashboard.view"],
  judge: ["scores.submit"],
  rider: [],
};

export function hasCapability(role: EventRole, capability: EventCapability): boolean {
  return CAPABILITIES[role].includes(capability);
}

export function assertCapability(
  role: EventRole | null,
  capability: EventCapability,
): void {
  if (!role || !hasCapability(role, capability)) {
    throw new LeagueDomainError("NOT_AUTHORIZED", "You are not authorized to perform this action");
  }
}

// ---------- invites & membership ----------

export interface InviteRowLike {
  role: string;
  code: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
}

export interface ActiveRoleCounts {
  organizers: number;
  judges: number;
  riders: number;
}

/**
 * Base62 encoding of random bytes — deterministic from the input so it is
 * unit-testable. The service feeds `crypto.getRandomValues` bytes.
 */
export function inviteCodeFromBytes(bytes: Uint8Array, length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  let carry = 0;
  let bits = 0;
  for (const byte of bytes) {
    carry = (carry << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += alphabet[(carry >> bits) & 63];
      if (out.length === length) return out;
    }
  }
  while (out.length < length) {
    out += alphabet[carry & 63];
  }
  return out.slice(0, length);
}

/**
 * Throws `INVITE_INVALID` (revoked/expired) or `INVITE_EXHAUSTED`
 * (use count reached) for unusable invites. A valid invite falls through.
 */
export function assertInviteUsable(invite: InviteRowLike, now: Date): void {
  if (invite.revokedAt !== null) {
    throw new LeagueDomainError("INVITE_INVALID", "This invite was revoked");
  }
  if (invite.expiresAt !== null && invite.expiresAt.getTime() <= now.getTime()) {
    throw new LeagueDomainError("INVITE_INVALID", "This invite has expired");
  }
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    throw new LeagueDomainError("INVITE_EXHAUSTED", "This invite reached its usage limit");
  }
}

/**
 * Invite creation is plan-gated: the free tier has a single organizer who
 * judges implicitly, so only rider invites exist there. Paid plans unlock
 * judge/organizer invites per their caps.
 */
export function assertInviteRoleAllowed(
  role: "organizer" | "judge" | "rider",
  plan: PlanCaps,
): void {
  if (role === "judge" && plan.maxJudges <= 0) {
    throw new LeagueDomainError(
      "NOT_AUTHORIZED",
      "Judges are a paid-tier feature for this event's plan",
    );
  }
  if (role === "organizer" && plan.maxOrganizers <= 1) {
    throw new LeagueDomainError(
      "NOT_AUTHORIZED",
      "Additional organizers are a paid-tier feature for this event's plan",
    );
  }
}

/**
 * Capacity math for joins/adds — throws `CAPACITY_EXCEEDED` when the target
 * role bucket is full. `maxJudges = 0` blocks judge joins entirely (free
 * tier: the organizer judges implicitly).
 */
export function assertCapacityForRole(
  role: "organizer" | "judge" | "rider",
  plan: PlanCaps,
  counts: ActiveRoleCounts,
): void {
  switch (role) {
    case "organizer":
      if (counts.organizers >= plan.maxOrganizers) {
        throw new LeagueDomainError(
          "CAPACITY_EXCEEDED",
          `This event allows at most ${plan.maxOrganizers} organizers`,
        );
      }
      return;
    case "judge":
      if (plan.maxJudges <= 0) {
        throw new LeagueDomainError(
          "CAPACITY_EXCEEDED",
          "This event's plan does not include judge seats",
        );
      }
      if (counts.judges >= plan.maxJudges) {
        throw new LeagueDomainError(
          "CAPACITY_EXCEEDED",
          `This event allows at most ${plan.maxJudges} judges`,
        );
      }
      return;
    case "rider":
      if (counts.riders >= plan.maxRiders) {
        throw new LeagueDomainError(
          "CAPACITY_EXCEEDED",
          `This event allows at most ${plan.maxRiders} riders`,
        );
      }
      return;
  }
}

// ---------- date helpers ----------

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

/** Calendar-month addition in UTC (month-end overflow normalizes via Date). */
export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
