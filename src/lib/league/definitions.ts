/**
 * League domain definitions — pure constants and the typed error taxonomy.
 * No IO; everything here is unit-testable and shared by the engine, the
 * services and the routes. See .agents/specs/league/engine.spec.md.
 */

import type { EventOrigin } from "@/types/sport-events";

// ---------- payment gate ----------

/** Days after creation without a registered payment until the event locks. */
export const PAYMENT_LOCK_AFTER_DAYS = 3;
/** Days after creation without a registered payment until final disable. */
export const PAYMENT_DISABLE_AFTER_DAYS = 6;

/**
 * Payment gate states (community events only — editorial events are always
 * `settled`):
 * - `pending`: payment not registered yet but before the lock deadline.
 * - `locked`: past the due date without payment — read-only, payment-only.
 * - `disabled`: past the final deadline without payment — definitive.
 * - `settled`: a payment is registered (free included) — everything enabled.
 */
export type PaymentGateState =
  | "pending"
  | "locked"
  | "disabled"
  | "settled";

// ---------- scheduling ----------

/** A community event may be scheduled at most this many months in advance. */
export const MAX_SCHEDULE_ADVANCE_MONTHS = 2;

/** Default minutes per scheduled run when the organizer does not override. */
export const DEFAULT_SLOT_MINUTES = 10;
export const MIN_SLOT_MINUTES = 5;
export const MAX_SLOT_MINUTES = 120;

/** Default judging window once a run starts. */
export const DEFAULT_WINDOW_MINUTES = 10;
export const MIN_WINDOW_MINUTES = 1;
export const MAX_WINDOW_MINUTES = 60;

// ---------- scoring ----------

export interface ScoringCriterionDefinition {
  key: string;
  label: string;
  weight: number;
  maxScore: number;
}

/** Defaults seeded into `event_scoring_criteria` at event creation. */
export const DEFAULT_SCORING_CRITERIA: readonly ScoringCriterionDefinition[] = [
  { key: "style", label: "Style", weight: 1, maxScore: 10 },
  { key: "consistency", label: "Consistency", weight: 1, maxScore: 10 },
  { key: "amplitude", label: "Amplitude", weight: 1, maxScore: 10 },
  { key: "technique", label: "Technique", weight: 1, maxScore: 10 },
];

// ---------- points ----------

/** Points awarded to every rider that attended a published event. */
export const ATTENDANCE_POINTS = 10;

/** Rank bonus table (1-based). Ranks beyond the table get the floor bonus. */
export const RANK_BONUS_POINTS: readonly number[] = [100, 80, 60, 50, 40];
export const RANK_BONUS_FLOOR = 25;

export function rankBonusPoints(rank: number): number {
  const index = Math.trunc(rank) - 1;
  if (index < 0) return 0;
  return RANK_BONUS_POINTS[index] ?? RANK_BONUS_FLOOR;
}

// ---------- plans ----------

export const FREE_PLAN_SLUG = "free";

/** Features unlocked only by a paid (non-free) plan. */
export const PAID_FEATURES = [
  "multi_organizer",
  "judge_invites",
  "organizer_invites",
  "historic_metrics",
] as const;

export type PaidFeature = (typeof PAID_FEATURES)[number];

// ---------- lifecycle ----------

export type EventStatus =
  | "draft"
  | "registration_open"
  | "registration_closed"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled";

/** Legal lifecycle transitions; the organizer performs all of them. */
export const EVENT_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  draft: ["registration_open", "cancelled"],
  registration_open: ["registration_closed", "cancelled"],
  registration_closed: ["scheduled", "cancelled"],
  scheduled: ["live", "cancelled"],
  live: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (from === to) return;
  if (!EVENT_TRANSITIONS[from].includes(to)) {
    throw new LeagueDomainError(
      "INVALID_TRANSITION",
      `Cannot transition an event from ${from} to ${to}`,
    );
  }
}

/**
 * Lifecycle states where configuration edits are still allowed (engine spec:
 * "edit config | any pre-live"). Live/completed/cancelled events are frozen.
 */
export const PRE_LIVE_EVENT_STATUSES: ReadonlySet<EventStatus> = new Set([
  "draft",
  "registration_open",
  "registration_closed",
  "scheduled",
]);

// ---------- roles ----------

export type EventRole = "main_organizer" | "organizer" | "judge" | "rider";

export const INVITE_ROLES = ["organizer", "judge", "rider"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

// ---------- membership / invites ----------

export interface PlanCaps {
  maxRiders: number;
  maxJudges: number;
  maxOrganizers: number;
}

/** Length of generated invite codes (base62). */
export const INVITE_CODE_LENGTH = 12;


// ---------- errors ----------

export type LeagueErrorCode =
  | "INVALID_TRANSITION"
  | "NOT_AUTHORIZED"
  | "STALE_VERSION"
  | "CAPACITY_EXCEEDED"
  | "QUOTA_EXCEEDED"
  | "ALREADY_MEMBER"
  | "INVITE_INVALID"
  | "INVITE_EXHAUSTED"
  | "PAYMENT_EXISTS"
  | "PAYMENT_NOT_FOUND"
  | "RUN_WINDOW_CLOSED"
  | "SCORE_INVALID"
  | "NOT_SCORED"
  | "EMPTY_SCHEDULE"
  | "EVENT_LOCKED"
  | "EVENT_DISABLED"
  | "SCHEDULE_TOO_FAR_AHEAD"
  | "IDEMPOTENCY_CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "PLAN_EXISTS"
  | "PLAN_NOT_FOUND"
  | "USER_NOT_FOUND";

export class LeagueDomainError extends Error {
  readonly code: LeagueErrorCode;

  constructor(code: LeagueErrorCode, message?: string) {
    super(message ?? code)
    this.name = "LeagueDomainError"
    this.code = code
  }
}

export function isLeagueDomainError(
  error: unknown,
): error is LeagueDomainError {
  return error instanceof LeagueDomainError
}

// ---------- misc ----------

/** Events with this editorial origin are exempt from league product rules. */
export const EDITORIAL_ORIGIN: EventOrigin = "seed";
