/**
 * League engine chain — full lifecycle integration smoke against a real DB.
 * Skipped unless `RUN_DB_SMOKE=1` (the default `pnpm test` run stays
 * DB-free). Cleanup removes every row it created and restores rider_stats.
 *
 *   RUN_DB_SMOKE=1 pnpm test src/lib/services/league/league-chain.smoke.test.ts
 */
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import "@/db/load-env";
import { getDirectDatabaseUrl } from "@/lib/config/env";
import { getPostgresOptions } from "@/lib/db/postgres-options";
import { FREE_PLAN_SLUG } from "@/lib/league/definitions";
import {
  closeEventRegistration,
  completeEvent,
  createEventInvite,
  createLeagueEvent,
  generateEventSchedule,
  getInvitePreview,
  joinEventByCode,
  openEventRegistration,
  publishEventResults,
  setRunWindow,
  startEvent,
  submitRunScore,
} from "./index";

const RUN = process.env.RUN_DB_SMOKE === "1";
const d = it;

describe.skipIf(!RUN)("league chain smoke (RUN_DB_SMOKE=1)", () => {
  d("runs create → join → schedule → score → publish", { timeout: 120_000 }, async () => {
    const url = getDirectDatabaseUrl();
    if (!url) throw new Error("no direct database url");
    const sql = postgres(url, getPostgresOptions("script", { max: 1 }));
    try {
      const profiles = await sql`select id from profiles order by created_at limit 3`;
      expect(profiles.length).toBeGreaterThanOrEqual(3);
      const organizerId = profiles[0]!.id;
      const riderAId = profiles[1]!.id;
      const riderBId = profiles[2]!.id;

      const [discipline] = await sql`select slug from sport_disciplines limit 1`;
      const statsBefore = await sql`select user_id, total_points, events_attended, events_won from rider_stats where user_id in (${organizerId}, ${riderAId}, ${riderBId})`;

      const future = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const created = await createLeagueEvent(organizerId, {
        name: "Smoke League Event",
        description: "",
        sports: [discipline!.slug],
        startDate: future.toISOString().slice(0, 10),
        city: "Smoke City",
        country: "United States",
        countryCode: "US",
        timezone: "UTC",
        category: "local-event",
      });
      const eventId = created.id;

      try {
        const invite = await createEventInvite(organizerId, {
          eventId,
          expectedVersion: created.version,
          idempotencyKey: crypto.randomUUID(),
          role: "rider",
        });
        const preview = await getInvitePreview(invite.code);
        expect(preview?.usable).toBe(true);
        const joined = await joinEventByCode(riderAId, invite.code, {
          idempotencyKey: crypto.randomUUID(),
        });
        expect(joined.role).toBe("rider");
        const invite2 = await createEventInvite(organizerId, {
          eventId,
          expectedVersion: joined.version,
          idempotencyKey: crypto.randomUUID(),
          role: "rider",
        });
        await joinEventByCode(riderBId, invite2.code, {
          idempotencyKey: crypto.randomUUID(),
        });

        const row = await sql`select version, status from sport_events where id = ${eventId}`;
        const opened = await openEventRegistration(organizerId, {
          eventId,
          expectedVersion: row[0]!.version,
          idempotencyKey: crypto.randomUUID(),
        });
        const closed = await closeEventRegistration(organizerId, {
          eventId,
          expectedVersion: opened.version,
          idempotencyKey: crypto.randomUUID(),
        });
        const scheduled = await generateEventSchedule(organizerId, {
          eventId,
          expectedVersion: closed.version,
          idempotencyKey: crypto.randomUUID(),
          slotMinutes: 5,
        });
        const started = await startEvent(organizerId, {
          eventId,
          expectedVersion: scheduled.version,
          idempotencyKey: crypto.randomUUID(),
        });

        const runs = await sql`select id, sequence from event_runs where event_id = ${eventId} order by sequence`;
        expect(runs).toHaveLength(2);
        let version = started.version;
        for (const run of runs) {
          const window = await setRunWindow(organizerId, {
            eventId,
            runId: run.id,
            mode: "open",
            windowMinutes: 5,
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
          });
          version = window.version;
          const scored = await submitRunScore(organizerId, {
            eventId,
            runId: run.id,
            scores: {
              style: 7 + Number(run.sequence),
              consistency: 6,
              amplitude: 8,
              technique: 7,
            },
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
          });
          version = scored.version;
          const closedWindow = await setRunWindow(organizerId, {
            eventId,
            runId: run.id,
            mode: "close",
            windowMinutes: 0,
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
          });
          version = closedWindow.version;
        }

        const completed = await completeEvent(organizerId, {
          eventId,
          expectedVersion: version,
          idempotencyKey: crypto.randomUUID(),
        });
        const published = await publishEventResults(organizerId, {
          eventId,
          expectedVersion: completed.version,
          idempotencyKey: crypto.randomUUID(),
        });
        expect(published.version).toBeGreaterThan(completed.version);

        const results = await sql`select rank from event_results where event_id = ${eventId} order by rank`;
        expect(results.map((r) => Number(r.rank))).toEqual([1, 2]);

        const ledger = await sql`select event_type from event_points_ledger where event_id = ${eventId}`;
        expect(ledger).toHaveLength(4);

        const notifications = await sql`select type from user_notifications where event_id = ${eventId}`;
        const types = new Set(notifications.map((n) => n.type));
        expect(types.has("league_schedule_published")).toBe(true);
        expect(types.has("league_event_started")).toBe(true);
        expect(types.has("league_results_published")).toBe(true);

        const plan = await sql`select plan_slug from sport_events where id = ${eventId}`;
        expect(plan[0]!.plan_slug).toBe(FREE_PLAN_SLUG);
      } finally {
        await sql`delete from user_notifications where event_id = ${eventId}`;
        for (const before of statsBefore) {
          await sql`update rider_stats set total_points = ${before.total_points}, events_attended = ${before.events_attended}, events_won = ${before.events_won}, updated_at = now() where user_id = ${before.user_id}`;
        }
        await sql`delete from rider_stats where user_id in (${organizerId}, ${riderAId}, ${riderBId}) and games_played = 0 and tricks_landed = 0 and tricks_failed = 0 and events_attended <= 1 and events_won <= 1 and total_points <= 200`;
        await sql`delete from sport_events where id = ${eventId}`;
      }
    } finally {
      await sql.end();
    }
  });
});
