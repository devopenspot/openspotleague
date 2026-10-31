import { useCallback, useMemo, useSyncExternalStore } from "react";

const HISTORY_KEY = "tv:history:v2";
const LEGACY_HISTORY_KEY = "tv:history:v1";
export const TV_HISTORY_MAX = 20;
/** A video only counts as started after this many seconds. */
export const TV_HISTORY_MIN_WATCH_S = 10;
/** At this share of the runtime a video counts as finished. */
export const TV_HISTORY_DONE_FRACTION = 0.9;

export interface TvHistoryEntry {
  id: string;
  /** Last position in seconds. */
  t: number;
  /** Duration in seconds; 0 when unknown (no bar, no resume). */
  d: number;
  /** Last watched at (epoch ms). */
  at: number;
}

const EMPTY: readonly TvHistoryEntry[] = Object.freeze([]);

/** Applies one watch update to the most-recent-first list. Pure — unit tested. */
export function applyTvWatch(
  list: readonly TvHistoryEntry[],
  entry: TvHistoryEntry,
  max: number = TV_HISTORY_MAX,
): readonly TvHistoryEntry[] {
  const rest = list.filter((v) => v.id !== entry.id);
  if (entry.d > 0 && entry.t / entry.d >= TV_HISTORY_DONE_FRACTION) return rest;
  if (entry.t < TV_HISTORY_MIN_WATCH_S && rest.length === list.length) {
    return list;
  }
  return [entry, ...rest].slice(0, max);
}

function parseEntry(value: unknown): TvHistoryEntry | null {
  // v1 stored bare ids: keep them, with no progress to show.
  if (typeof value === "string") return { id: value, t: 0, d: 0, at: 0 };
  if (typeof value !== "object" || value === null) return null;
  const { id, t, d, at } = value as Record<string, unknown>;
  if (typeof id !== "string") return null;
  if (typeof t !== "number" || typeof d !== "number") return null;
  return { id, t, d, at: typeof at === "number" ? at : 0 };
}

export function parseTvHistory(raw: string | null): readonly TvHistoryEntry[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const entries = data
      .map(parseEntry)
      .filter((v): v is TvHistoryEntry => v !== null);
    return entries.length ? entries.slice(0, TV_HISTORY_MAX) : EMPTY;
  } catch {
    return EMPTY;
  }
}

// useSyncExternalStore needs a referentially stable snapshot while the
// underlying value is unchanged — cache by raw string.
let cachedRaw: string | null = null;
let cachedSnapshot: readonly TvHistoryEntry[] = EMPTY;
const listeners = new Set<() => void>();

function readSnapshot(): readonly TvHistoryEntry[] {
  let raw: string | null;
  try {
    raw =
      window.localStorage.getItem(HISTORY_KEY) ??
      window.localStorage.getItem(LEGACY_HISTORY_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = parseTvHistory(raw);
  }
  return cachedSnapshot;
}

function write(next: readonly TvHistoryEntry[]) {
  try {
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
    if (next.length === 0) window.localStorage.removeItem(HISTORY_KEY);
    else window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — history is best-effort
  }
}

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HISTORY_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Where to reopen a video; 0 when there's nothing to resume. */
export function getTvResumeTime(id: string): number {
  const entry = readSnapshot().find((v) => v.id === id);
  return entry && entry.d > 0 ? Math.floor(entry.t) : 0;
}

/** Watch history with progress (localStorage, SSR-safe, cross-tab synced). */
export function useTvWatchHistory() {
  const entries = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
  const ids = useMemo(() => entries.map((v) => v.id), [entries]);
  const progressById = useMemo(
    () =>
      new Map(
        entries.filter((v) => v.d > 0).map((v) => [v.id, v.t / v.d] as const),
      ),
    [entries],
  );
  // Saves quietly while the player is open: rows hidden behind it don't
  // need to re-render, so listeners only hear about it on `flush`.
  const track = useCallback((id: string, t: number, d: number) => {
    write(applyTvWatch(readSnapshot(), { id, t, d, at: Date.now() }));
  }, []);
  const flush = useCallback(() => notify(), []);
  const clear = useCallback(() => {
    write([]);
    notify();
  }, []);
  return { ids, progressById, track, flush, clear };
}
