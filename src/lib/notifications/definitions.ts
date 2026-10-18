/**
 * Notification type constants + copy rendering — pure module shared by the
 * service payloads and the UI so wording never drifts. Types mirror the
 * `NotificationType` union in `src/types/sport-events.ts`; v1 is in-app only
 * (see plan.league.spec.md decisions — email/push arrive in Phase 5).
 */

import type { NotificationPayload, NotificationType } from "@/types/sport-events";

export interface NotificationCopy {
  title: string;
  body: string;
}

export function isNotificationType(value: string): value is NotificationType {
  return NOTIFICATION_TYPES.has(value as NotificationType);
}

/**
 * Every notification type the app can emit. Direct organizer adds use
 * `league_member_added` (a retired `league_invite_received` never had an
 * emitter); email digests cover the `EMAIL_DIGEST_TYPES` subset below.
 */
export const NOTIFICATION_TYPES: ReadonlySet<string> = new Set<string>([
  "league_invite_revoked",
  "league_registration_confirmed",
  "league_member_added",
  "league_member_removed",
  "league_schedule_published",
  "league_event_started",
  "league_event_cancelled",
  "league_results_published",
  "league_points_earned",
  "league_payment_registered",
  "league_payment_pending_admin",
]);

/**
 * Canonical email-digest subset (0032 sweep + `user_notifications_email_pending_idx`
 * filter): event-level signals riders need away from the app. Membership
 * add/remove churn, invite revocations, and payment bookkeeping stay in-app.
 */
export const EMAIL_DIGEST_TYPES: readonly NotificationType[] = [
  "league_registration_confirmed",
  "league_schedule_published",
  "league_event_started",
  "league_event_cancelled",
  "league_results_published",
  "league_points_earned",
];

/** Types that deep-link into the admin payment queue instead of the event. */
const ADMIN_TYPES: ReadonlySet<string> = new Set<string>([
  "league_payment_pending_admin",
]);

/**
 * Deep link for a notification row: event surfaces by slug, admin alerts to
 * the payments queue. Returns null when the payload lacks a destination
 * (client falls back to /notifications only).
 */
export function notificationHref(
  type: string,
  payload: NotificationPayload,
): string | null {
  if (ADMIN_TYPES.has(type)) return "/admin/league/payments";
  return payload.eventSlug ? `/sport-events/${payload.eventSlug}` : null;
}

function eventLabel(payload: NotificationPayload): string {
  return payload.eventName ?? "the event";
}

function roleLabel(role: NotificationPayload["role"]): string {
  switch (role) {
    case "main_organizer":
      return "main organizer";
    case "organizer":
      return "organizer";
    case "judge":
      return "judge";
    case "rider":
      return "rider";
    default:
      return "participant";
  }
}

export function renderNotification(
  type: NotificationType,
  payload: NotificationPayload,
): NotificationCopy {
  const event = eventLabel(payload);
  switch (type) {
    case "league_invite_revoked":
      return {
        title: "Invite revoked",
        body: `The invite used for ${event} was revoked by an organizer.`,
      };
    case "league_registration_confirmed":
      // Recipient-side copy ("You're in"); when an actor is present the row
      // targets organizers announcing someone else's self-join.
      if (payload.actorName) {
        return {
          title: "New registration",
          body: `${payload.actorName} joined ${event} as ${roleLabel(payload.role)}.`,
        };
      }
      return {
        title: "Registration confirmed",
        body: `You're in — ${event} (${roleLabel(payload.role)}).`,
      };
    case "league_member_added":
      return {
        title: "Added to event",
        body: `${payload.actorName ?? "An organizer"} added you to ${event} as ${roleLabel(payload.role)}.`,
      };
    case "league_member_removed":
      return {
        title: "Removed from event",
        body: `You were removed from ${event}.`,
      };
    case "league_schedule_published":
      return {
        title: "Schedule published",
        body: `The run order for ${event} is live.`,
      };
    case "league_event_started":
      return {
        title: "Event is live",
        body: `${event} just started — check the live board.`,
      };
    case "league_event_cancelled":
      return {
        title: "Event cancelled",
        body: `${event} was cancelled by the organizer.`,
      };
    case "league_results_published": {
      const placement =
        typeof payload.rank === "number" && payload.rank > 0
          ? ` You finished #${payload.rank} with ${payload.points ?? 0} points.`
          : "";
      return {
        title: "Results published",
        body: `Results for ${event} are out.${placement}`,
      };
    }
    case "league_points_earned":
      return {
        title: "Points earned",
        body: `+${payload.points ?? 0} points for ${event}.`,
      };
    case "league_payment_registered":
      return {
        title: "Payment registered",
        body: `${event} is ready to move forward (${payload.planSlug ?? "free"} plan).`,
      };
    case "league_payment_pending_admin":
      return {
        title: "Payment awaiting review",
        body: `${event} registered a ${payload.planSlug ?? "paid"} plan payment.`,
      };
  }
}
