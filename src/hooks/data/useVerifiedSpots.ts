import { useCallback, useEffect, useSyncExternalStore } from "react"
import { showToast } from "@/hooks/ui/useToast"
import { useInitialVerifiedSpots } from "@/lib/contexts/verified-spots-context"
import { useSpotsStore } from "@/stores/spots-store"
import type { MapSpot } from "@/lib/types"

type Listener = () => void

interface UserStore {
  ids: Set<string>
  channel: BroadcastChannel | null
  listeners: Set<Listener>
}

const userStores = new Map<string, UserStore>()
const EMPTY_SET: Set<string> = new Set()
const UNSIGNED_KEY = "__unsigned__"

function channelName(userId: string): string {
  return `openspot:verified-spots:${userId}`
}

function notify(userId: string): void {
  const key = userId || UNSIGNED_KEY
  const store = userStores.get(key)
  if (!store) return
  for (const l of store.listeners) l()
}

function ensureUserStore(userId: string, initialIds: readonly string[]): UserStore {
  const key = userId || UNSIGNED_KEY
  let store = userStores.get(key)
  if (store) return store
  store = {
    ids: new Set(initialIds),
    channel: null,
    listeners: new Set<Listener>(),
  }
  userStores.set(key, store)
  return store
}

function subscribe(userId: string, listener: Listener): () => void {
  if (typeof window === "undefined") return () => {}
  const store = ensureUserStore(userId, [])
  store.listeners.add(listener)
  if (userId && !store.channel && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(channelName(userId))
      channel.addEventListener("message", (event) => {
        const data = event.data as
          | { type?: unknown; spotId?: unknown; isVerified?: unknown }
          | null
        if (
          !data ||
          data.type !== "toggle" ||
          typeof data.spotId !== "string" ||
          typeof data.isVerified !== "boolean"
        )
          return
        const s = userStores.get(userId)
        if (!s) return
        const next = new Set(s.ids)
        if (data.isVerified) next.add(data.spotId)
        else next.delete(data.spotId)
        s.ids = next
        notify(userId)
      })
      store.channel = channel
    } catch {
      store.channel = null
    }
  }
  return () => {
    const key = userId || UNSIGNED_KEY
    const s = userStores.get(key)
    if (!s) return
    s.listeners.delete(listener)
    if (s.listeners.size === 0 && s.channel) {
      try {
        s.channel.close()
      } catch {
        // ignore
      }
      s.channel = null
    }
  }
}

function getSnapshot(userId: string): Set<string> {
  const key = userId || UNSIGNED_KEY
  return userStores.get(key)?.ids ?? EMPTY_SET
}

function getServerSnapshot(): Set<string> {
  return EMPTY_SET
}

/**
 * Patches the per-spot `verificationCount` on the `useSpotsStore` zustand
 * store. The optimistic +1/-1 fires synchronously with the toggle;
 * once the API responds, the server's authoritative count replaces
 * the optimistic value (handles races where a concurrent toggle by
 * another user already bumped the count before ours committed).
 */
function applyVerificationCount(spotId: string, nextCount: number): void {
  const { spots, setSpots } = useSpotsStore.getState()
  let found = false
  const next = spots.map((s: MapSpot) => {
    if (s.id !== spotId) return s
    if (s.verificationCount === nextCount) {
      found = true
      return s
    }
    found = true
    return { ...s, verificationCount: nextCount }
  })
  if (found) setSpots(next)
}

export function useVerifiedSpots(userId: string | null) {
  const userKey = userId ?? ""
  const initialFromContext = useInitialVerifiedSpots()
  // The hook lives on the client; the server snapshot returns an
  // empty set so SSR matches the first paint, and the per-user
  // initial set is seeded via the context after hydration.
  const initialIds = initialFromContext.map((v) => v.spotId)

  useEffect(() => {
    if (!userKey) return
    const store = ensureUserStore(userKey, initialIds)
    notify(userKey)
    // Touch `store` so the lint sees the side-effect of
    // initialising it for this user (no-op if already initialised).
    void store
  }, [userKey, initialIds])

  const subscribed = useSyncExternalStore(
    (listener) => subscribe(userKey, listener),
    () => getSnapshot(userKey),
    getServerSnapshot,
  )

  const isVerified = useCallback(
    (id: string) => subscribed.has(id),
    [subscribed],
  )

  const doToggle = async (id: string, meta?: { name?: string }) => {
    if (!userId) {
      showToast("Sign in to verify spots", "error")
      return
    }
    const store = ensureUserStore(userId, [])
    const prevIds = store.ids
    const wasVerified = prevIds.has(id)
    const nowVerified = !wasVerified
    const next = new Set(prevIds)
    if (nowVerified) next.add(id)
    else next.delete(id)
    store.ids = next
    notify(userId)

    // Optimistic count: bump the per-spot counter in the zustand
    // store so the chip in the card / detail / popup updates
    // immediately. On API success the server's authoritative value
    // replaces it; on failure the rollback below reverts it.
    const current = useSpotsStore.getState().spots.find((s) => s.id === id)
    const previousCount = current?.verificationCount
    const optimisticCount =
      previousCount !== undefined
        ? Math.max(0, previousCount + (nowVerified ? 1 : -1))
        : undefined
    if (optimisticCount !== undefined) {
      applyVerificationCount(id, optimisticCount)
    }

    try {
      const res = nowVerified
        ? await fetch("/api/verified-spots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spotId: id }),
          })
        : await fetch(`/api/verified-spots/${encodeURIComponent(id)}`, {
            method: "DELETE",
          })
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      // Apply the server's authoritative count when present. The
      // server returns the post-trigger `verification_count` from
      // the verify / unverify service. For `204 No Content` paths
      // (none currently, but kept defensive) we keep the optimistic
      // value and rely on the next list refetch to correct drift.
      if (res.status !== 204) {
        const body = (await res.json().catch(() => null)) as
          | { count?: number }
          | null
        if (body && typeof body.count === "number") {
          applyVerificationCount(id, body.count)
        }
      }
      try {
        store.channel?.postMessage({
          type: "toggle",
          spotId: id,
          isVerified: nowVerified,
        })
      } catch {
        // best-effort cross-tab broadcast
      }

      if (nowVerified) {
        showToast(
          meta?.name ? `Verified ${meta.name}` : "Marked as verified",
          "success",
          { title: "Verifications" },
        )
      } else {
        showToast(
          meta?.name
            ? `Removed verification from ${meta.name}`
            : "Verification removed",
          "info",
          {
            title: "Verifications",
            durationMs: 5000,
            action: {
              label: "Undo",
              onClick: () => {
                void doToggle(id, meta)
              },
            },
          },
        )
      }
    } catch (err) {
      // Revert both the per-user set and the optimistic count.
      const s = userStores.get(userId)
      if (s) {
        s.ids = prevIds
        notify(userId)
      }
      if (previousCount !== undefined) {
        applyVerificationCount(id, previousCount)
      }
      const msg = err instanceof Error ? err.message : "Toggle failed"
      showToast(`Could not sync verification: ${msg}`, "error")
    }
  }

  const toggle = doToggle

  return {
    verifiedIds: subscribed,
    isVerified,
    toggle,
    count: subscribed.size,
  } as const
}
