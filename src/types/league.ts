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
  | "league_payment_pending_admin";

export interface NotificationPayload {
  eventId?: string;
  eventSlug?: string;
  eventName?: string;
  role?: EventRole;
  points?: number;
  rank?: number;
  actorName?: string;
  planSlug?: string;
}

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
