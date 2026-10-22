import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMAIL_DIGEST_TYPES,
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
    ).toBe("/sport-events/night-jam");
    expect(notificationHref("league_points_earned", {})).toBeNull();
  });
});

describe("EMAIL_DIGEST_TYPES", () => {
  it("is a strict subset of the emit types", () => {
    for (const type of EMAIL_DIGEST_TYPES) {
      expect(NOTIFICATION_TYPES.has(type)).toBe(true);
    }
  });

  it("matches the digest whitelist in the sweep migration (drift guard)", () => {
    const migrationPath = [
      path.join(process.cwd(), "supabase", "migrations", "0032_email_sweep_hardening.sql"),
      path.join(process.cwd(), "supabase", "migrations_archive", "0032_email_sweep_hardening.sql"),
    ].find((candidate) => existsSync(candidate));
    const sql = readFileSync(migrationPath!, "utf8");
    const start = sql.indexOf("digest_types text[] := array[");
    const end = sql.indexOf("];", start);
    const whitelist = sql.slice(start, end);
    for (const type of EMAIL_DIGEST_TYPES) {
      expect(whitelist, `${type} missing from sweep digest list`).toContain(type);
    }
    const listed = [...whitelist.matchAll(/'((?:league|payment)_\w+)'/g)].map(
      (match) => match[1],
    );
    expect(listed).toHaveLength(EMAIL_DIGEST_TYPES.length);
  });
});
