import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_POINTS,
  LeagueDomainError,
  RANK_BONUS_FLOOR,
} from "./definitions";
import {
  addDays,
  addMonths,
  assertCapability,
  assertCapacityForRole,
  assertEventWritable,
  assertInviteRoleAllowed,
  assertInviteUsable,
  assertPaymentWindowOpen,
  assertScheduleAdvanceWindow,
  assertScheduleReorderable,
  buildDefaultCriteria,
  buildRescheduledSlots,
  buildSchedule,
  clampSlotMinutes,
  clampWindowMinutes,
  inviteCodeFromBytes,
  judgeTotal,
  ledgerEventKey,
  maxScheduleDate,
  paymentGate,
  pointsForRank,
  rankRuns,
  runTotal,
} from "./engine";

const CREATED = new Date("2026-09-01T12:00:00.000Z");

function gate(
  now: Date,
  options?: { origin?: "seed" | "community"; hasActivePayment?: boolean },
) {
  return paymentGate({
    origin: options?.origin ?? "community",
    createdAt: CREATED,
    hasActivePayment: options?.hasActivePayment ?? false,
    now,
  });
}

describe("paymentGate", () => {
  it("is pending before the 3-day due date", () => {
    const result = gate(addDays(CREATED, 2));
    expect(result.state).toBe("pending");
    expect(result.paymentDueAt).toEqual(addDays(CREATED, 3));
    expect(result.paymentDeadlineAt).toEqual(addDays(CREATED, 6));
  });

  it("locks at exactly 3 days without payment", () => {
    expect(gate(addDays(CREATED, 3)).state).toBe("locked");
  });

  it("disables at exactly 6 days without payment", () => {
    expect(gate(addDays(CREATED, 6)).state).toBe("disabled");
  });

  it("is settled once a payment is registered, even after the deadline", () => {
    const result = gate(addDays(CREATED, 30), { hasActivePayment: true });
    expect(result.state).toBe("settled");
    expect(result.paymentDueAt).toBeNull();
    expect(result.paymentDeadlineAt).toBeNull();
  });

  it("editorial events are always settled", () => {
    const result = gate(addDays(CREATED, 30), { origin: "seed" });
    expect(result.state).toBe("settled");
  });
});

describe("assertEventWritable", () => {
  it("allows pending and settled events", () => {
    expect(() => assertEventWritable(gate(addDays(CREATED, 1)))).not.toThrow();
    expect(() =>
      assertEventWritable(gate(addDays(CREATED, 1), { hasActivePayment: true })),
    ).not.toThrow();
  });

  it("throws a typed lock error at the due date", () => {
    expect(() => assertEventWritable(gate(addDays(CREATED, 3)))).toThrowError(
      LeagueDomainError,
    );
    try {
      assertEventWritable(gate(addDays(CREATED, 3)));
    } catch (error) {
      expect((error as LeagueDomainError).code).toBe("EVENT_LOCKED");
    }
  });

  it("throws a typed disabled error past the deadline", () => {
    try {
      assertEventWritable(gate(addDays(CREATED, 6)));
    } catch (error) {
      expect((error as LeagueDomainError).code).toBe("EVENT_DISABLED");
    }
  });
});

describe("assertPaymentWindowOpen", () => {
  it("allows pending and locked states", () => {
    expect(() => assertPaymentWindowOpen(gate(addDays(CREATED, 3)))).not.toThrow();
  });

  it("rejects disabled events", () => {
    expect(() => assertPaymentWindowOpen(gate(addDays(CREATED, 6)))).toThrowError(
      LeagueDomainError,
    );
  });
});

describe("scheduling advance window", () => {
  const now = new Date("2026-09-01T00:00:00.000Z");

  it("accepts a start date exactly two months out", () => {
    expect(() => assertScheduleAdvanceWindow(addMonths(now, 2), now)).not.toThrow();
    expect(maxScheduleDate(now)).toEqual(addMonths(now, 2));
  });

  it("rejects anything beyond two months", () => {
    const tooFar = new Date(addMonths(now, 2).getTime() + 60_000);
    try {
      assertScheduleAdvanceWindow(tooFar, now);
    } catch (error) {
      expect((error as LeagueDomainError).code).toBe("SCHEDULE_TOO_FAR_AHEAD");
    }
  });

  it("accepts past and near dates (cap only)", () => {
    expect(() => assertScheduleAdvanceWindow(now, now)).not.toThrow();
  });
});

describe("scoring", () => {
  const criteria = buildDefaultCriteria();

  it("computes a weighted judge total", () => {
    const weighted = [
      { key: "style", label: "Style", weight: 2, maxScore: 10 },
      { key: "technique", label: "Technique", weight: 1, maxScore: 10 },
    ];
    expect(judgeTotal({ style: 8, technique: 7 }, weighted)).toBe(7.67);
    expect(judgeTotal({ style: 9, consistency: 8, amplitude: 7, technique: 6 }, criteria)).toBe(7.5);
  });

  it("rejects missing and out-of-range scores", () => {
    expect(() => judgeTotal({ style: 9, consistency: 8 }, criteria)).toThrowError(
      LeagueDomainError,
    );
    expect(() =>
      judgeTotal({ style: 11, consistency: 8, amplitude: 8, technique: 8 }, criteria),
    ).toThrowError(LeagueDomainError);
  });

  it("averages judge totals for the run total", () => {
    expect(runTotal([8, 9])).toBe(8.5);
    expect(() => runTotal([])).toThrowError(LeagueDomainError);
  });
});

describe("ranking and points", () => {
  it("ranks by total, best judge total, then sequence", () => {
    const ranked = rankRuns([
      { runId: "c", total: 9, bestJudgeTotal: 9, sequence: 3 },
      { runId: "a", total: 9.5, bestJudgeTotal: 10, sequence: 1 },
      { runId: "b", total: 9, bestJudgeTotal: 9.5, sequence: 2 },
      { runId: "d", total: 9, bestJudgeTotal: 9, sequence: 1 },
    ]);
    expect(ranked.map((run) => run.runId)).toEqual(["a", "b", "d", "c"]);
    expect(ranked.map((run) => run.rank)).toEqual([1, 2, 3, 4]);
  });

  it("awards attendance plus rank bonus", () => {
    expect(pointsForRank(1)).toBe(ATTENDANCE_POINTS + 100);
    expect(pointsForRank(5)).toBe(ATTENDANCE_POINTS + 40);
    expect(pointsForRank(9)).toBe(ATTENDANCE_POINTS + RANK_BONUS_FLOOR);
    expect(ledgerEventKey("e1", "u1", "rank")).toBe("event:e1:rider:u1:rank");
  });
});

describe("schedule", () => {
  const startAt = new Date("2026-09-20T15:00:00.000Z");

  it("plans one run per rider with slot spacing", () => {
    const planned = buildSchedule({
      riderMembershipIds: ["m1", "m2", "m3"],
      startAt,
      slotMinutes: 30,
    });
    expect(planned.map((run) => run.membershipId)).toEqual(["m1", "m2", "m3"]);
    expect(planned[2]?.scheduledAt).toEqual(new Date("2026-09-20T16:00:00.000Z"));
  });

  it("requires at least one rider and clamps slot minutes", () => {
    expect(() => buildSchedule({ riderMembershipIds: [], startAt })).toThrowError(
      LeagueDomainError,
    );
    expect(clampSlotMinutes(1)).toBe(5);
    expect(clampSlotMinutes(999)).toBe(120);
    expect(clampWindowMinutes(0)).toBe(1);
    expect(clampWindowMinutes(500)).toBe(60);
  });
});

describe("capabilities", () => {
  it("lets organizers judge implicitly and manage the event", () => {
    expect(() => assertCapability("main_organizer", "scores.submit")).not.toThrow();
    expect(() => assertCapability("organizer", "config.edit")).not.toThrow();
    expect(() => assertCapability("organizer", "members.remove")).toThrowError(
      LeagueDomainError,
    );
    expect(() => assertCapability("judge", "config.edit")).toThrowError(
      LeagueDomainError,
    );
    expect(() => assertCapability(null, "scores.submit")).toThrowError(
      LeagueDomainError,
    );
  });
});

describe("invites & membership", () => {
  const FREE_PLAN = { maxRiders: 3, maxJudges: 0, maxOrganizers: 1 };
  const PRO_PLAN = { maxRiders: 55, maxJudges: 4, maxOrganizers: 5 };

  it("rejects revoked, expired and exhausted invites", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const base = { code: "abc123", useCount: 0, maxUses: null, expiresAt: null, revokedAt: null };
    expect(() => assertInviteUsable({ ...base, role: "rider" }, now)).not.toThrow();
    expect(() =>
      assertInviteUsable({ ...base, role: "rider", revokedAt: now }, now),
    ).toThrowError(/revoked/);
    expect(() =>
      assertInviteUsable(
        { ...base, role: "rider", expiresAt: new Date(now.getTime() - 1) },
        now,
      ),
    ).toThrowError(/expired/);
    expect(() =>
      assertInviteUsable({ ...base, role: "rider", maxUses: 1, useCount: 1 }, now),
    ).toThrowError(/usage limit/);
    expect(() =>
      assertInviteUsable({ ...base, role: "rider", maxUses: 1, useCount: 0 }, now),
    ).not.toThrow();
  });

  it("gates invite roles by plan caps", () => {
    expect(() => assertInviteRoleAllowed("rider", FREE_PLAN)).not.toThrow();
    expect(() => assertInviteRoleAllowed("judge", FREE_PLAN)).toThrowError(/paid-tier/);
    expect(() => assertInviteRoleAllowed("organizer", FREE_PLAN)).toThrowError(/paid-tier/);
    expect(() => assertInviteRoleAllowed("judge", PRO_PLAN)).not.toThrow();
    expect(() => assertInviteRoleAllowed("organizer", PRO_PLAN)).not.toThrow();
  });

  it("enforces capacity per role bucket", () => {
    const full = { organizers: 1, judges: 0, riders: 3 };
    expect(() => assertCapacityForRole("rider", FREE_PLAN, { organizers: 1, judges: 0, riders: 2 })).not.toThrow();
    expect(() => assertCapacityForRole("rider", FREE_PLAN, full)).toThrowError(/riders/);
    expect(() => assertCapacityForRole("judge", FREE_PLAN, { organizers: 1, judges: 0, riders: 0 })).toThrowError(
      /judge seats/,
    );
    expect(() =>
      assertCapacityForRole("judge", PRO_PLAN, { organizers: 1, judges: 4, riders: 0 }),
    ).toThrowError(/judges/);
    expect(() =>
      assertCapacityForRole("organizer", PRO_PLAN, { organizers: 5, judges: 0, riders: 0 }),
    ).toThrowError(/organizers/);
  });

  it("encodes invite codes deterministically from bytes", () => {
    expect(inviteCodeFromBytes(new Uint8Array(16).fill(0), 12)).toHaveLength(12);
    expect(inviteCodeFromBytes(new Uint8Array([255]), 12)).toBe(
      inviteCodeFromBytes(new Uint8Array([255]), 12),
    );
    expect(inviteCodeFromBytes(new Uint8Array([0, 1]), 12)).not.toBe(
      inviteCodeFromBytes(new Uint8Array([0, 2]), 12),
    );
  });

  it("gates run reorder to scheduled events and unjudged live runs", () => {
    expect(() => assertScheduleReorderable("scheduled", ["scored", "judging"])).not.toThrow();
    expect(() => assertScheduleReorderable("live", ["scheduled", "scheduled"])).not.toThrow();
    expect(() => assertScheduleReorderable("live", ["scheduled", "judging"])).toThrowError(
      /before judging starts/,
    );
    expect(() => assertScheduleReorderable("live", ["scored", "skipped"])).toThrowError(
      LeagueDomainError,
    );
    expect(() => assertScheduleReorderable("completed", [])).toThrowError(
      LeagueDomainError,
    );
    expect(() => assertScheduleReorderable("cancelled", [])).toThrowError(
      LeagueDomainError,
    );
  });

  it("builds reordered slots from explicit sequences, clamping the slot", () => {
    const startAt = new Date("2026-10-01T12:00:00.000Z");
    const slots = buildRescheduledSlots({
      runs: [
        { runId: "r2", sequence: 2 },
        { runId: "r1", sequence: 1 },
      ],
      startAt,
      slotMinutes: 10,
    });
    expect(slots).toEqual([
      { runId: "r2", sequence: 2, scheduledAt: new Date("2026-10-01T12:10:00.000Z") },
      { runId: "r1", sequence: 1, scheduledAt: startAt },
    ]);
    const clampedSlots = buildRescheduledSlots({
      runs: [{ runId: "r1", sequence: 3 }],
      startAt,
      slotMinutes: 500,
    });
    expect(clampedSlots[0]?.scheduledAt).toEqual(
      new Date(startAt.getTime() + 240 * 60_000),
    );
  });
});
