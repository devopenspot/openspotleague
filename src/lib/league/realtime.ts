/**
 * League realtime — mirrors the games signal flow: DB trigger + service
 * writes land in `event_realtime_signals`; the browser subscribes to
 * `league:event:<id>` filtered on the signal row and refetches the
 * authorized state through the application API (never trusts the payload).
 * Polling fallback 2s → 30s cap, 5s channel-stall grace, visibility pause.
 * All league viewers are signed in — no guest polling path needed.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  createRefreshCoordinator,
  type RealtimeController,
} from "@/lib/games/realtime"

const POLL_INITIAL_DELAY_MS = 2_000
const POLL_MAX_DELAY_MS = 30_000
const FALLBACK_GRACE_MS = 5_000

export function subscribeToLeagueEvent(options: {
  eventId: string
  refreshState: () => Promise<void>
  onConnectionChange?: (status: "connected" | "reconnecting") => void
  getCurrentVersion?: () => number | null | undefined
}): RealtimeController {
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null
  let pollInFlight = false
  let pollDelayMs = POLL_INITIAL_DELAY_MS
  let pollingFallback = false
  let channelConnected = false
  let stopped = false

  const stopPolling = () => {
    if (!pollTimer) return
    clearTimeout(pollTimer)
    pollTimer = null
  }

  const schedulePolling = () => {
    if (
      stopped ||
      !pollingFallback ||
      pollTimer ||
      pollInFlight ||
      (typeof document !== "undefined" && document.visibilityState === "hidden")
    )
      return
    pollTimer = setTimeout(async () => {
      pollTimer = null
      if (stopped) return
      pollInFlight = true
      try {
        await coordinator.refresh()
        pollDelayMs = POLL_INITIAL_DELAY_MS
      } catch {
        pollDelayMs = Math.min(POLL_MAX_DELAY_MS, pollDelayMs * 2)
      } finally {
        pollInFlight = false
        schedulePolling()
      }
    }, pollDelayMs)
  }

  const coordinator = createRefreshCoordinator({
    refreshState: options.refreshState,
    onSuccess: () => options.onConnectionChange?.("connected"),
    onFailure: () => {
      options.onConnectionChange?.("reconnecting")
      schedulePolling()
    },
  })

  let removeChannel = () => undefined
  try {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`league:event:${options.eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_realtime_signals",
          filter: `event_id=eq.${options.eventId}`,
        },
        (payload?: { new?: { version?: unknown } | null }) => {
          const signalVersion = payload?.new?.version
          const currentVersion = options.getCurrentVersion?.()
          if (
            typeof signalVersion === "number" &&
            typeof currentVersion === "number" &&
            signalVersion <= currentVersion
          ) {
            return
          }
          coordinator.schedule()
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (fallbackTimer) clearTimeout(fallbackTimer)
          channelConnected = true
          pollingFallback = false
          stopPolling()
          options.onConnectionChange?.("connected")
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          if (fallbackTimer) clearTimeout(fallbackTimer)
          channelConnected = false
          pollingFallback = true
          options.onConnectionChange?.("reconnecting")
          schedulePolling()
        }
      })
    removeChannel = () => void supabase.removeChannel(channel)
  } catch {
    channelConnected = false
    pollingFallback = true
    options.onConnectionChange?.("reconnecting")
    schedulePolling()
  }

  // A stalled channel may not emit an error callback — delayed fallback.
  if (typeof document === "undefined" || document.visibilityState !== "hidden") {
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null
      if (channelConnected) return
      pollingFallback = true
      schedulePolling()
    }, FALLBACK_GRACE_MS)
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      stopPolling()
      return
    }
    void coordinator.refresh().catch(() => undefined)
    if (pollingFallback) schedulePolling()
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange)
  }

  return {
    refresh: coordinator.refresh,
    stop: () => {
      stopped = true
      coordinator.stop()
      stopPolling()
      if (fallbackTimer) clearTimeout(fallbackTimer)
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
      removeChannel()
    },
  }
}
