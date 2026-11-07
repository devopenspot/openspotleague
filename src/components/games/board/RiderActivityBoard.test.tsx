import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  RiderActivityBoard,
  activityTone,
  layoutActivity,
  summarizeActivity,
} from "@/components/games/board/RiderActivityBoard";
import type { RiderActivityDay } from "@/lib/services/profile/ranking";

function run(start: string, counts: number[]): RiderActivityDay[] {
  const base = new Date(`${start}T00:00:00Z`);
  return counts.map((count, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), count, points: count * 10 };
  });
}

describe("activityTone", () => {
  it("uses the green scale from empty through peak activity", () => {
    expect(activityTone(0, 10)).toBe("bg-activity-empty");
    expect(activityTone(2, 10)).toBe("bg-activity-low");
    expect(activityTone(5, 10)).toBe("bg-activity-medium");
    expect(activityTone(8, 10)).toBe("bg-activity-high");
    expect(activityTone(9, 10)).toBe("bg-activity-peak");
  });
});

describe("layoutActivity", () => {
  it("puts days on Monday-first rows, padding the first week", () => {
    // 2026-08-13 is a Thursday → row 3 of the first column.
    const layout = layoutActivity(run("2026-08-13", Array(84).fill(0)));
    expect(layout.cells[0]).toMatchObject({ column: 0, row: 3 });
    expect(layout.cells[4]).toMatchObject({ column: 1, row: 0 });
    expect(layout.columns).toBe(13);
  });

  it("labels each month once, on the first week that starts inside it", () => {
    const layout = layoutActivity(run("2026-08-13", Array(84).fill(0)));
    expect(layout.months.map((m) => m.label)).toEqual(["Aug", "Sep", "Oct", "Nov"]);
    // Sep 7 2026 is the first Monday of September.
    const sep = layout.months.find((m) => m.label === "Sep");
    expect(layout.cells.find((c) => c.day.date === "2026-09-07")?.column).toBe(sep?.column);
  });

  it("returns an empty layout for no days", () => {
    expect(layoutActivity([])).toEqual({ cells: [], columns: 0, months: [] });
  });
});

describe("summarizeActivity", () => {
  it("totals events, points, active days and the best streak", () => {
    expect(summarizeActivity(run("2026-11-01", [1, 2, 0, 3, 1, 1, 0]))).toEqual({
      events: 8,
      points: 80,
      activeDays: 5,
      bestStreak: 3,
    });
  });
});

describe("RiderActivityBoard", () => {
  it("shows the summary and an empty-state note for a quiet rider", () => {
    render(<RiderActivityBoard data={{ days: run("2026-08-13", Array(84).fill(0)), error: false }} />);
    expect(screen.getByRole("heading", { name: "Last 12 weeks" })).toBeInTheDocument();
    expect(screen.getByText("Active days")).toBeInTheDocument();
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
  });
});
