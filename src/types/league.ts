import type { SportDiscipline } from "@/types/disciplines";

export type ContestStatus = "upcoming" | "live" | "completed";

/**
 * Editorial taxonomy (`event_categories`): how prominent a directory event
 * is. Payment tiers are a separate concept (`event_plans`) — "tier" in
 * product language refers to billing, never to this field.
 */
export type ContestCategory =
  | "world-tour"
  | "championship"
  | "festival"
  | "federation"
  | "local-event";

export const CONTEST_CATEGORIES: readonly ContestCategory[] = [
  "world-tour",
  "championship",
  "festival",
  "federation",
  "local-event",
] as const;

export type EventVisibility = "public" | "unlisted";
export type EventLifecycleStatus =
  | "draft"
  | "registration_open"
  | "registration_closed"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled";
export type EventRole = "main_organizer" | "organizer" | "judge" | "rider";
export type EventMembershipStatus = "active" | "removed" | "withdrawn";
export type EventRunStatus =
  | "scheduled"
  | "submitted"
  | "judging"
  | "scored"
  | "skipped"
  | "completed";
export type EventPaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "comped"
  | "failed";
export type EventSignalType =
  | "event_state_changed"
  | "registration_changed"
  | "schedule_published"
  | "run_started"
  | "score_submitted"
  | "results_published"
  | "event_cancelled";

export type NotificationType =
  | "league_invite_revoked"
  | "league_registration_confirmed"
  | "league_member_added"
  | "league_member_removed"
  | "league_schedule_published"
  | "league_event_started"
  | "league_event_cancelled"
  | "league_results_published"
  | "league_points_earned"
  | "league_payment_registered"
  | "league_payment_pending_admin"
  | "league_registration_opened"
  | "league_registration_closed"
  | "league_contest_updated"
  | "league_video_submitted"
  | "league_scoring_complete"
  | "league_video_deadline_reminder"
  | "league_judging_reminder"
  | "league_payment_gate_reminder";

/** Contest fields whose change triggers `league_contest_updated`. */
export type ContestChangeField = "schedule" | "location" | "deadline";

export interface NotificationPayload {
  eventId?: string;
  eventSlug?: string;
  eventName?: string;
  role?: EventRole;
  points?: number;
  rank?: number;
  actorName?: string;
  planSlug?: string;
  /** `league_contest_updated`: which fields changed. */
  changes?: ContestChangeField[];
  /** Deadline-style reminders: the instant being warned about (ISO). */
  dueAt?: string;
  /** IANA zone of the contest, to show `dueAt` in local time. */
  timeZone?: string;
  /** `league_judging_reminder`: runs waiting for this judge. */
  pendingCount?: number;
  /** `league_payment_gate_reminder`: what happens tomorrow. */
  gateStep?: "lock" | "disable";
}

/** Email outbox state on a notification row (migration 0009). */
export type NotificationEmailStatus =
  | "pending"
  | "queued"
  | "sent"
  | "skipped"
  | "bounced"
  | "failed";

export type NotificationEmailUrgency = "immediate" | "digest";

/** Email preference categories (one toggle each). */
export type NotificationEmailCategory =
  | "contest_updates"
  | "reminders"
  | "judging"
  | "results";

export interface ContestLocation {
  city: string;
  citySlug?: string;
  address?: string;
  country: string;
  countryCode?: string;
  region?: string;
  venue?: string;
  latitude?: number;
  longitude?: number;
}

export interface Contest {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  url: string | null;
  image: string;
  imagePath?: string | null;
  description: string;
  sports: readonly SportDiscipline[];
  startDate: string;
  endDate?: string;
  location: ContestLocation;
  category: ContestCategory;
  categoryName: string;
  featured?: boolean;
  visibility: EventVisibility;
  lifecycleStatus: EventLifecycleStatus;
  timezone: string;
  spotName?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContestEnriched extends Contest {
  status: ContestStatus;
  dateRangeLabel: string;
}

/**
 * Minimum event shape the map needs to plot a marker, render the
 * `EventMarker` pin, and populate the `MapInfoPopup` / `EventPanel`.
 * Produced by `listEventsForMap` (see `src/lib/services/event/events.ts`)
 * by dropping description / socials / full address from a
 * `ContestEnriched` and projecting `location.latitude` /
 * `location.longitude` into `lat` / `lon` for Leaflet. The shape
 * is the contract between the service projection and every map
 * consumer — keep it here, not inline in a component.
 */
export interface MapEvent {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  city: string;
  citySlug?: string;
  country: string;
  category: ContestCategory;
  categoryName: string;
  status: ContestStatus;
  dateRangeLabel: string;
  startDate: string;
  endDate?: string;
  url: string | null;
  lat: number;
  lon: number;
}
