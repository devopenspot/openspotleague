import { describe, expect, it } from "vitest";
import {
  EMAIL_CATEGORIES,
  EMAIL_POLICY,
  NOTIFICATION_TYPES,
  notificationHref,
  renderNotification,
} from "./definitions";

describe("renderNotification", () => {
  it("covers every notification type with non-empty copy", () => {
    for (const type of NOTIFICATION_TYPES) {
      const copy = renderNotification(type as never, {
        eventName: "Night Jam",
        actorName: "Ada",
        role: "rider",
        points: 100,
        rank: 1,
        planSlug: "starter",
      });
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });

  it("renders placement copy when rank is present", () => {
    const copy = renderNotification("league_results_published", {
      eventName: "Night Jam",
      rank: 2,
      points: 80,
    });
    expect(copy.body).toContain("#2");
    expect(copy.body).toContain("80 points");
  });

  it("renders points and plan details", () => {
    expect(
      renderNotification("league_points_earned", { eventName: "Night Jam", points: 100 }).body,
    ).toContain("+100 points");
    expect(
      renderNotification("league_payment_registered", {
        eventName: "Night Jam",
        planSlug: "starter",
      }).body,
    ).toContain("starter");
  });
});

describe("notificationHref", () => {
  it("deep-links admin alerts to the payments queue", () => {
    expect(
      notificationHref("league_payment_pending_admin", { eventSlug: "night-jam" }),
    ).toBe("/admin/league/payments");
  });

  it("deep-links member alerts to the event page", () => {
    expect(
      notificationHref("league_schedule_published", { eventSlug: "night-jam" }),
    ).toBe("/league/night-jam");
    expect(notificationHref("league_points_earned", {})).toBeNull();
  });
});

describe("EMAIL_POLICY", () => {
  it("gives every emailed type a category", () => {
    for (const [type, policy] of Object.entries(EMAIL_POLICY)) {
      if (policy.urgency !== null) {
        expect(policy.category, `${type} needs a category`).not.toBeNull();
        expect(EMAIL_CATEGORIES).toContain(policy.category);
      }
    }
  });

  it("emails urgent contest moments immediately", () => {
    expect(EMAIL_POLICY.league_event_cancelled.urgency).toBe("immediate");
    expect(EMAIL_POLICY.league_results_published.urgency).toBe("immediate");
    expect(EMAIL_POLICY.league_video_deadline_reminder.urgency).toBe("immediate");
  });

  it("keeps points and bookkeeping in-app only", () => {
    expect(EMAIL_POLICY.league_points_earned.urgency).toBeNull();
    expect(EMAIL_POLICY.league_payment_pending_admin.urgency).toBeNull();
    expect(EMAIL_POLICY.league_member_removed.urgency).toBeNull();
  });
});

describe("new notification copy", () => {
  it("lists changed contest fields", () => {
    expect(
      renderNotification("league_contest_updated", {
        eventName: "Night Jam",
        changes: ["schedule", "location", "deadline"],
      }).body,
    ).toContain("schedule, location and video deadline");
  });

  it("pluralizes pending judging runs", () => {
    expect(
      renderNotification("league_judging_reminder", { eventName: "Night Jam", pendingCount: 1 }).body,
    ).toContain("1 run in Night Jam is waiting");
    expect(
      renderNotification("league_judging_reminder", { eventName: "Night Jam", pendingCount: 3 }).body,
    ).toContain("3 runs in Night Jam are waiting");
  });

  it("distinguishes the payment gate steps", () => {
    expect(
      renderNotification("league_payment_gate_reminder", { gateStep: "lock" }).title,
    ).toContain("locks");
    expect(
      renderNotification("league_payment_gate_reminder", { gateStep: "disable" }).title,
    ).toContain("disables");
  });

  it("formats the video deadline", () => {
    expect(
      renderNotification("league_video_deadline_reminder", {
        eventName: "Night Jam",
        dueAt: "2026-11-06T18:00:00.000Z",
      }).body,
    ).toContain("Nov 6");
  });
});
