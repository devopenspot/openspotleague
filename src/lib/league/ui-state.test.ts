import { describe, expect, it } from "vitest";
import {
  formatDateRange,
  formatCountdown,
  formatEventTimeInZone,
  groupLeagueEvents,
  isOrganizerRole,
  isWindowActive,
  money,
  pickOpenRun,
  relativeTime,
  roleLabel,
  statusLabel,
} from "./ui-state";

describe("formatDateRange", () => {
  it("renders single dates with the year and ranges without", () => {
    expect(formatDateRange("2026-10-03", null)).toBe("Oct 3, 2026");
    expect(formatDateRange("2026-10-03", "2026-10-03")).toBe("Oct 3, 2026");
    expect(formatDateRange("2026-10-03", "2026-10-05")).toBe("Oct 3 – Oct 5");
  });

  it("falls back to the raw input for invalid dates", () => {
    expect(formatDateRange("not-a-date", null)).toBe("not-a-date");
  });
});

describe("formatEventTimeInZone", () => {
  it("renders the same instant in the event timezone", () => {
    const iso = "2026-10-01T12:00:00.000Z";
    expect(formatEventTimeInZone(iso, "UTC")).toContain("12:00");
    expect(formatEventTimeInZone(iso, "America/Los_Angeles")).toContain("5:00");
  });

  it("survives an unknown timezone by falling back to UTC", () => {
    expect(formatEventTimeInZone("2026-10-01T12:00:00.000Z", "Mars/Olympus")).toContain(
      "12:00",
    );
  });
});

describe("relativeTime", () => {
  it("formats the four buckets deterministically", () => {
    const now = Date.parse("2026-09-14T12:00:00.000Z");
    expect(relativeTime("2026-09-14T12:00:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-09-14T11:55:00.000Z", now)).toBe("5m ago");
    expect(relativeTime("2026-09-14T09:30:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-09-12T12:00:00.000Z", now)).toBe("2d ago");
    expect(relativeTime("garbage", now)).toBe("");
  });
});

describe("formatCountdown", () => {
  it("clamps at zero and zero-pads seconds", () => {
    expect(formatCountdown(65_000)).toBe("1:05");
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(9_000)).toBe("0:09");
  });
});

describe("window pick", () => {
  const runs = [
    { id: "a", windowEndsAt: "2026-09-14T12:00:00.000Z" },
    { id: "b", windowEndsAt: "2026-09-14T12:10:00.000Z" },
    { id: "c", windowEndsAt: null },
  ];
  const before = Date.parse("2026-09-14T11:00:00.000Z");
  const after = Date.parse("2026-09-14T13:00:00.000Z");

  it("prefers the first run whose window is still open", () => {
    expect(pickOpenRun(runs, before)?.id).toBe("a");
  });

  it("falls back to the first judging run when everything expired", () => {
    expect(pickOpenRun(runs, after)?.id).toBe("a");
  });

  it("treats an unknown clock as active", () => {
    expect(isWindowActive({ windowEndsAt: "2026-09-14T12:10:00.000Z" }, null)).toBe(true);
    expect(isWindowActive({ windowEndsAt: "2026-09-14T12:00:00.000Z" }, after)).toBe(false);
    expect(isWindowActive({ windowEndsAt: null }, before)).toBe(false);
  });
});

describe("groupLeagueEvents", () => {
  it("buckets by role in a stable order", () => {
    const items = [
      { id: "1", myRole: "rider" as const },
      { id: "2", myRole: "organizer" as const },
      { id: "3", myRole: "main_organizer" as const },
      { id: "4", myRole: "judge" as const },
    ];
    const groups = groupLeagueEvents(items);
    expect(groups.organizing.map((item) => item.id)).toEqual(["2", "3"]);
    expect(groups.judging.map((item) => item.id)).toEqual(["4"]);
    expect(groups.riding.map((item) => item.id)).toEqual(["1"]);
  });
});

describe("labels + misc", () => {
  it("labels known roles/statuses and falls back to the raw value", () => {
    expect(roleLabel("main_organizer")).toBe("Main organizer");
    expect(roleLabel("unknown")).toBe("unknown");
    expect(statusLabel("registration_open")).toBe("Registration open");
    expect(statusLabel("weird")).toBe("weird");
  });

  it("classifies organizer roles", () => {
    expect(isOrganizerRole("main_organizer")).toBe(true);
    expect(isOrganizerRole("organizer")).toBe(true);
    expect(isOrganizerRole("judge")).toBe(false);
    expect(isOrganizerRole(null)).toBe(false);
  });

  it("formats currency from cents", () => {
    expect(money(0)).toBe("$0.00");
    expect(money(2100)).toBe("$21.00");
  });
});
