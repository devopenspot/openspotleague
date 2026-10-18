/**
 * Pure derived state shared by league UIs (hub cards, judge queue, manage
 * console, notifications). No React, no "use client" — every function is
 * deterministic and unit-tested (repo convention: `header-state.ts` style).
 */

export type LeagueUiRole = "main_organizer" | "organizer" | "judge" | "rider";

export const ROLE_LABELS: Record<LeagueUiRole, string> = {
  main_organizer: "Main organizer",
  organizer: "Organizer",
  judge: "Judge",
  rider: "Rider",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as LeagueUiRole] ?? role;
}

/** `true` for roles that can manage the event (console CTAs, paths). */
export function isOrganizerRole(role: string | null): boolean {
  return role === "main_organizer" || role === "organizer";
}

/** Currency display for plan prices (single source — no per-table copies). */
export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

/** "Oct 3 – Oct 5" style range label in UTC (calendar dates, not times). */
export function formatDateRange(start: string, end: string | null): string {
  const startDate = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime())) return start;
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(startDate);
  if (!end || end === start) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(startDate);
  }
  const endDate = new Date(`${end}T00:00:00Z`);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(endDate);
  return `${startLabel} – ${endLabel}`;
}

/** Absolute event start time rendered in the event's own timezone. */
export function formatEventTimeInZone(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    // Unknown IANA zone — fall back to UTC rather than throwing at render.
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" for notification rows. */
export function relativeTime(iso: string, nowMs = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = nowMs - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** "m:ss" judging-window countdown, clamped at zero. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface UiRunLike {
  windowEndsAt: string | null;
}

/** A window is active when it exists and (as far as known) hasn't expired. */
export function isWindowActive(run: UiRunLike, nowMs: number | null): boolean {
  if (run.windowEndsAt === null) return false;
  return nowMs === null || new Date(run.windowEndsAt).getTime() > nowMs;
}

/**
 * The run the judge should score next: first judging run whose window is
 * still open; falls back to the first judging run when the clock is unknown.
 */
export function pickOpenRun<T extends UiRunLike>(
  judgingRuns: readonly T[],
  nowMs: number | null,
): T | undefined {
  return (
    judgingRuns.find((run) => isWindowActive(run, nowMs)) ?? judgingRuns[0]
  );
}

/** Hub grouping: role → three buckets in a stable order. */
export function groupLeagueEvents<T extends { myRole: LeagueUiRole }>(
  items: readonly T[],
): { organizing: T[]; judging: T[]; riding: T[] } {
  return {
    organizing: items.filter(
      (item) => item.myRole === "main_organizer" || item.myRole === "organizer",
    ),
    judging: items.filter((item) => item.myRole === "judge"),
    riding: items.filter((item) => item.myRole === "rider"),
  };
}
