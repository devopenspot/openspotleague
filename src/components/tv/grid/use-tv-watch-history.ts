import { useCallback, useSyncExternalStore } from "react";

const HISTORY_KEY = "tv:history:v1";
export const TV_HISTORY_MAX = 20;

const EMPTY: readonly string[] = Object.freeze([]);

/** Most-recent-first, de-duplicated, capped list. Pure — unit tested. */
export function pushTvHistory(
  list: readonly string[],
  id: string,
  max: number = TV_HISTORY_MAX,
): string[] {
  return [id, ...list.filter((v) => v !== id)].slice(0, max);
}

function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const ids = data.filter((v): v is string => typeof v === "string");
    return ids.length ? ids.slice(0, TV_HISTORY_MAX) : EMPTY;
  } catch {
    return EMPTY;
  }
}

// useSyncExternalStore needs a referentially stable snapshot while the
// underlying value is unchanged — cache by raw string.
let cachedRaw: string | null = null;
let cachedSnapshot: readonly string[] = EMPTY;
const listeners = new Set<() => void>();

function readSnapshot(): readonly string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = parse(raw);
  }
  return cachedSnapshot;
}

function write(next: readonly string[]) {
  try {
    if (next.length === 0) window.localStorage.removeItem(HISTORY_KEY);
    else window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — history is best-effort
  }
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

/** Recently watched video ids (localStorage, SSR-safe, cross-tab synced). */
export function useTvWatchHistory() {
  const ids = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
  const record = useCallback((id: string) => {
    write(pushTvHistory(readSnapshot(), id));
  }, []);
  const clear = useCallback(() => write([]), []);
  return { ids, record, clear };
}
