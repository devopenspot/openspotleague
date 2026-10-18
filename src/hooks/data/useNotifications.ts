"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationPayload } from "@/types/sport-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface NotificationListItem {
  id: string;
  type: string;
  payload: NotificationPayload;
  title: string;
  body: string;
  eventId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface ListResponse {
  items: NotificationListItem[];
  unreadCount: number;
  nextCursor: string | null;
}

const REFRESH_DEBOUNCE_MS = 75;

async function fetchList(params: string): Promise<ListResponse | null> {
  const response = await fetch(`/api/notifications?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as ListResponse;
}

/**
 * Bell-badge hook: unread count only (tiny payload), realtime via the
 * per-user `user:<uid>` postgres_changes channel on `user_notifications`
 * (mirrors the games signal pattern), refetch-on-focus as fallback.
 */
export function useUnreadNotificationCount(userId: string | null): number {
  const [storedUnread, setStoredUnread] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Derived: anonymous visitors always read zero without touching state.
  const unreadCount = userId ? storedUnread : 0;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const data = await fetchList("limit=1&unread=1");
      if (cancelled) return;
      if (data) setStoredUnread(data.unreadCount);
    })();

    let client: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    let channel: ReturnType<
      ReturnType<typeof createSupabaseBrowserClient>["channel"]
    > | null = null;
    try {
      client = createSupabaseBrowserClient();
      channel = client
        .channel(`user:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              debounceRef.current = null;
              void (async () => {
                const data = await fetchList("limit=1&unread=1");
                if (cancelled) return;
                if (data) setStoredUnread(data.unreadCount);
              })();
            }, REFRESH_DEBOUNCE_MS);
          },
        )
        .subscribe();
    } catch {
      client = null;
    }

    const refreshOnFocus = () => {
      // Only the hidden→visible transition is interesting; hidden-side
      // events would double-fetch for nothing.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void (async () => {
        const data = await fetchList("limit=1&unread=1");
        if (cancelled) return;
        if (data) setStoredUnread(data.unreadCount);
      })();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", refreshOnFocus);
      window.addEventListener("focus", refreshOnFocus);
    }

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [userId]);

  return unreadCount;
}

/**
 * `/notifications` page hook: paginated list + unread count, mark-read
 * write-through, same realtime/focus refresh as the bell.
 */
export function useNotificationList(userId: string | null): {
  items: NotificationListItem[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  markRead: (ids?: readonly string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [storedLoading, setStoredLoading] = useState(true);
  // Derived: anonymous visitors never show a loading state.
  const loading = userId ? storedLoading : false;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStoredLoading(false);
      return;
    }
    const data = await fetchList("limit=30");
    if (data) {
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    }
    setStoredLoading(false);
  }, [userId]);

  const loadMoreRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!userId || !cursor || loadMoreRef.current) return;
    // In-flight guard: a double click must not fire two fetches with the
    // same cursor (they would append duplicate rows).
    loadMoreRef.current = true;
    try {
      const data = await fetchList(`limit=30&before=${encodeURIComponent(cursor)}`);
      if (data) {
        setItems((current) => [...current, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(Boolean(data.nextCursor));
      }
    } finally {
      loadMoreRef.current = false;
    }
  }, [userId, cursor]);

  const markRead = useCallback(async (ids?: readonly string[]) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : { all: true }),
    });
    setItems((current) =>
      current.map((item) =>
        !ids || ids.includes(item.id)
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item,
      ),
    );
    await refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    await markRead(undefined);
  }, [markRead]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const data = await fetchList("limit=30");
      if (cancelled) return;
      if (data) {
        setItems(data.items);
        setUnreadCount(data.unreadCount);
        setCursor(data.nextCursor);
        setHasMore(Boolean(data.nextCursor));
      }
      setStoredLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let client: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null = null;
    try {
      client = createSupabaseBrowserClient();
      channel = client
        .channel(`user:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              debounceRef.current = null;
              if (!cancelled) void refresh();
            }, REFRESH_DEBOUNCE_MS);
          },
        )
        .subscribe();
    } catch {
      client = null;
    }
    const onFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (!cancelled) void refresh();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onFocus);
      window.addEventListener("focus", onFocus);
    }
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [userId, refresh]);

  return {
    items,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
    refresh,
  };
}

/**
 * Email-digest preference (default on) with delivery feature detection:
 * `deliveryAvailable === null` means unknown/anonymous — the UI hides the
 * toggle unless it is explicitly true. Toggle via PUT.
 */
export function useEmailDigests(userId: string | null): {
  enabled: boolean | null;
  deliveryAvailable: boolean | null;
  saving: boolean;
  saveError: string | null;
  setEnabled: (value: boolean) => Promise<void>;
} {
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    void (async () => {
      if (!userId) {
        setEnabledState(null);
        return;
      }
      try {
        const response = await fetch("/api/notifications/email-preferences", {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!response.ok) return;
        const data = (await response.json()) as {
          emailDigests: boolean;
          deliveryAvailable?: boolean;
        };
        if (cancelled) return;
        setEnabledState(data.emailDigests);
        setDeliveryAvailable(data.deliveryAvailable ?? null);
      } catch {
        if (!cancelled) setEnabledState(null);
      }
    })();
    return () => {
      cancelled = true;
      aliveRef.current = false;
    };
  }, [userId]);

  const setEnabled = useCallback(async (value: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/notifications/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailDigests: value }),
      });
      if (response.ok) {
        if (aliveRef.current) setEnabledState(value);
      } else {
        setSaveError("Could not update the email preference");
      }
    } catch {
      setSaveError("Could not update the email preference");
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }, []);

  return { enabled, deliveryAvailable, saving, saveError, setEnabled };
}
