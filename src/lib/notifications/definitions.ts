/**
 * Notification type constants, email policy and copy rendering — pure module
 * shared by the service payloads, the email templates and the UI so wording
 * never drifts. Types mirror the `NotificationType` union in
 * `src/types/league.ts`. Email delivery: see docs/notifications.md.
 */

import type {
  ContestChangeField,
  NotificationEmailCategory,
  NotificationEmailUrgency,
  NotificationPayload,
  NotificationType,
} from "@/types/league";
import { buildContestDetailUrl } from "@/lib/league/urls";

export interface NotificationCopy {
  title: string;
  body: string;
}

export function isNotificationType(value: string): value is NotificationType {
  return NOTIFICATION_TYPES.has(value as NotificationType);
}

/**
 * Email delivery policy per type — the single place to tune what reaches the
 * inbox. `urgency: null` keeps the type in-app only.
 * - `immediate`: enqueued right after the write commits (seconds).
 * - `digest`: batched into one email per user by the 15-minute tick.
 * `category` maps to the user's per-category email toggle.
 */
export interface EmailPolicy {
  urgency: NotificationEmailUrgency | null;
  category: NotificationEmailCategory | null;
}

export const EMAIL_POLICY: Readonly<Record<NotificationType, EmailPolicy>> = {
  league_event_cancelled: { urgency: "immediate", category: "contest_updates" },
  league_event_started: { urgency: "immediate", category: "contest_updates" },
  league_registration_confirmed: { urgency: "digest", category: "contest_updates" },
  league_member_added: { urgency: "digest", category: "contest_updates" },
  league_schedule_published: { urgency: "digest", category: "contest_updates" },
  league_registration_opened: { urgency: "digest", category: "contest_updates" },
  league_registration_closed: { urgency: "digest", category: "contest_updates" },
  league_contest_updated: { urgency: "digest", category: "contest_updates" },
  league_video_deadline_reminder: { urgency: "immediate", category: "reminders" },
  league_judging_reminder: { urgency: "immediate", category: "reminders" },
  league_payment_gate_reminder: { urgency: "immediate", category: "reminders" },
  league_video_submitted: { urgency: "digest", category: "judging" },
  league_scoring_complete: { urgency: "digest", category: "judging" },
  league_results_published: { urgency: "immediate", category: "results" },
  // In-app only.
  league_points_earned: { urgency: null, category: "results" },
  league_invite_revoked: { urgency: null, category: null },
  league_member_removed: { urgency: null, category: null },
  league_payment_registered: { urgency: null, category: null },
  league_payment_pending_admin: { urgency: null, category: null },
};

export const EMAIL_CATEGORIES: readonly NotificationEmailCategory[] = [
  "contest_updates",
  "reminders",
  "judging",
  "results",
];

export function emailPolicyFor(type: NotificationType): EmailPolicy {
  return EMAIL_POLICY[type];
}

/** Every notification type the app can emit (keys of `EMAIL_POLICY`). */
export const NOTIFICATION_TYPES: ReadonlySet<string> = new Set<string>(
  Object.keys(EMAIL_POLICY),
);

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
  return payload.eventSlug ? buildContestDetailUrl(payload.eventSlug) : null;
}

function eventLabel(payload: NotificationPayload): string {
  return payload.eventName ?? "the contest";
}

const CHANGE_LABELS: Record<ContestChangeField, string> = {
  schedule: "schedule",
  location: "location",
  deadline: "video deadline",
};

function changesLabel(changes: readonly ContestChangeField[] | undefined): string {
  const labels = (changes ?? []).map((field) => CHANGE_LABELS[field]);
  if (labels.length === 0) return "details";
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function dueLabel(dueAt: string | undefined): string {
  if (!dueAt) return "soon";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "soon";
  return `on ${due.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })}`;
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
        title: "Added to contest",
        body: `${payload.actorName ?? "An organizer"} added you to ${event} as ${roleLabel(payload.role)}.`,
      };
    case "league_member_removed":
      return {
        title: "Removed from contest",
        body: `You were removed from ${event}.`,
      };
    case "league_schedule_published":
      return {
        title: "Schedule published",
        body: `The run order for ${event} is live.`,
      };
    case "league_event_started":
      return {
        title: "Contest is live",
        body: `${event} just started — check the live board.`,
      };
    case "league_event_cancelled":
      return {
        title: "Contest cancelled",
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
    case "league_registration_opened":
      return {
        title: "Registration open",
        body: `Registration for ${event} is open.`,
      };
    case "league_registration_closed":
      return {
        title: "Registration closed",
        body: `Registration for ${event} is closed — runs are being prepared.`,
      };
    case "league_contest_updated":
      return {
        title: "Contest updated",
        body: `The ${changesLabel(payload.changes)} for ${event} changed.`,
      };
    case "league_video_submitted":
      return {
        title: "New video to score",
        body: `${payload.actorName ?? "A rider"} submitted a run video for ${event}.`,
      };
    case "league_scoring_complete":
      return {
        title: "All runs scored",
        body: `Every run in ${event} is scored or skipped — you can complete the contest and publish results.`,
      };
    case "league_video_deadline_reminder":
      return {
        title: "Video deadline in 24 hours",
        body: `Submit your run video for ${event} — the deadline is ${dueLabel(payload.dueAt)}.`,
      };
    case "league_judging_reminder": {
      const count = payload.pendingCount ?? 0;
      return {
        title: "Runs waiting for your score",
        body:
          count > 0
            ? `${count} run${count === 1 ? "" : "s"} in ${event} ${count === 1 ? "is" : "are"} waiting for your score.`
            : `Runs in ${event} are waiting for your score.`,
      };
    }
    case "league_payment_gate_reminder":
      return payload.gateStep === "disable"
        ? {
            title: "Contest disables tomorrow",
            body: `${event} has no settled payment and will be disabled tomorrow.`,
          }
        : {
            title: "Contest locks tomorrow",
            body: `${event} has no settled payment and will be locked tomorrow.`,
          };
  }
}
