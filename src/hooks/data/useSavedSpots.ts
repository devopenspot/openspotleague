import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { showToast } from "@/hooks/ui/useToast";
import type { SavedSpot } from "@/types/saved-spot";
import { useInitialSavedSpots } from "@/lib/contexts/saved-spots-context";

type Listener = () => void;

interface UserStore {
  ids: Set<string>;
  channel: BroadcastChannel | null;
  listeners: Set<Listener>;
}

const userStores = new Map<string, UserStore>();
const EMPTY_SET: Set<string> = new Set();
const UNSIGNED_KEY = "__unsigned__";

function channelName(userId: string): string {
  return `openspot:saved-spots:${userId}`;
}

function ensureUserStore(userId: string, initialIds: readonly string[]): UserStore {
  const key = userId || UNSIGNED_KEY;
  let store = userStores.get(key);
  if (store) return store;
  store = {
    ids: new Set(initialIds),
    channel: null,
    listeners: new Set<Listener>(),
  };
  userStores.set(key, store);
  return store;
}

function notify(userId: string): void {
  const key = userId || UNSIGNED_KEY;
  const store = userStores.get(key);
  if (!store) return;
  for (const l of store.listeners) l();
}

function subscribe(userId: string, listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const store = ensureUserStore(userId, []);
  store.listeners.add(listener);
  if (userId && !store.channel && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(channelName(userId));
      channel.addEventListener("message", (event) => {
        const data = event.data as
          | { type?: unknown; spotId?: unknown; isSaved?: unknown }
          | null;
        if (
          !data ||
          data.type !== "toggle" ||
          typeof data.spotId !== "string" ||
          typeof data.isSaved !== "boolean"
        )
          return;
        const s = userStores.get(userId);
        if (!s) return;
        const next = new Set(s.ids);
        if (data.isSaved) next.add(data.spotId);
        else next.delete(data.spotId);
        s.ids = next;
        notify(userId);
      });
      store.channel = channel;
    } catch {
      store.channel = null;
    }
  }
  return () => {
    const key = userId || UNSIGNED_KEY;
    const s = userStores.get(key);
    if (!s) return;
    s.listeners.delete(listener);
    if (s.listeners.size === 0 && s.channel) {
      try {
        s.channel.close();
      } catch {
        // ignore
      }
      s.channel = null;
    }
  };
}

function getSnapshot(userId: string): Set<string> {
  const key = userId || UNSIGNED_KEY;
  return userStores.get(key)?.ids ?? EMPTY_SET;
}

function getServerSnapshot(): Set<string> {
  return EMPTY_SET;
}

let legacyCleared = false;

function clearLegacyStorage(): void {
  if (legacyCleared) return;
  if (typeof window === "undefined") return;
  legacyCleared = true;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("openspot_saved_ids_")) toRemove.push(k);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function useSavedSpots(
  userId: string | null,
  initialServerSavedSpotsArg?: readonly SavedSpot[],
) {
  const contextInitial = useInitialSavedSpots();
  const initialIds = useMemo(() => {
    if (!userId) return [] as readonly string[];
    const source =
      initialServerSavedSpotsArg ??
      (contextInitial.length > 0 ? contextInitial : undefined);
    return (source ?? []).map((s) => s.spotId);
  }, [userId, initialServerSavedSpotsArg, contextInitial]);

  useEffect(() => {
    ensureUserStore(userId ?? "", initialIds);
    clearLegacyStorage();
    notify(userId ?? "");
  }, [userId, initialIds]);

  const savedIds = useSyncExternalStore(
    (listener) => subscribe(userId ?? "", listener),
    () => getSnapshot(userId ?? ""),
    getServerSnapshot,
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const doToggle = async (id: string, meta?: { name?: string }) => {
    if (!userId) {
      showToast("Sign in to save spots", "error");
      return;
    }
    const store = ensureUserStore(userId, []);
    const prevIds = store.ids;
    const next = new Set(prevIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const nowSaved = next.has(id);
    store.ids = next;
    notify(userId);

    try {
      const res = nowSaved
        ? await fetch("/api/saved-spots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spotId: id }),
          })
        : await fetch(`/api/saved-spots/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      try {
        store.channel?.postMessage({ type: "toggle", spotId: id, isSaved: nowSaved });
      } catch {
        // best-effort cross-tab broadcast
      }

      if (nowSaved) {
        showToast(
          meta?.name ? `Saved ${meta.name}` : "Saved to favorites",
          "success",
          { title: "Favorites" },
        );
      } else {
        showToast(
          meta?.name ? `Removed ${meta.name}` : "Removed from favorites",
          "info",
          {
            title: "Favorites",
            durationMs: 5000,
            action: {
              label: "Undo",
              onClick: () => {
                void doToggle(id, meta);
              },
            },
          },
        );
      }
    } catch (err) {
      const s = userStores.get(userId);
      if (s) {
        s.ids = prevIds;
        notify(userId);
      }
      const msg = err instanceof Error ? err.message : "Toggle failed";
      showToast(`Could not sync saved spot: ${msg}`, "error");
    }
  };

  const toggle = doToggle;

  return {
    savedIds,
    isSaved,
    toggle,
    count: savedIds.size,
  } as const;
}
