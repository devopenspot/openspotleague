import { createSupabaseBrowserClient, uniqueChannelTopic } from "@/lib/supabase/browser"

export type VersionedGameState = { version: number; [key: string]: unknown }

export function acceptAuthoritativeState<T extends VersionedGameState>(current: T | null, incoming: T): T | null {
  if (current && incoming.version <= current.version) return current
  return incoming
}

export type RealtimeController = {
  refresh: () => Promise<void>
  stop: () => void
}

type RefreshCoordinator = {
  refresh: () => Promise<void>
  schedule: () => void
  stop: () => void
}

const DEFAULT_REFRESH_TIMEOUT_MS = 12_000

export function createRefreshCoordinator({
  refreshState,
  onSuccess,
  onFailure,
  debounceMs = 75,
  refreshTimeoutMs = DEFAULT_REFRESH_TIMEOUT_MS,
}: {
  refreshState: () => Promise<void>
  onSuccess?: () => void
  onFailure?: () => void
  debounceMs?: number
  refreshTimeoutMs?: number
}): RefreshCoordinator {
  let stopped = false
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let refreshPromise: Promise<void> | null = null
  let queuedRefresh: Promise<void> | null = null

  const refresh = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    if (refreshPromise) {
      queuedRefresh ??= refreshPromise.then(() => {
        queuedRefresh = null
        return refresh()
      }, () => {
        queuedRefresh = null
        return refresh()
      })
      return queuedRefresh
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const execution =
      refreshTimeoutMs > 0 && Number.isFinite(refreshTimeoutMs)
        ? Promise.race([
            refreshState(),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error(`Refresh timed out after ${refreshTimeoutMs}ms`))
              }, refreshTimeoutMs)
            }),
          ])
        : refreshState()

    refreshPromise = execution
      .then(() => onSuccess?.())
      .catch((error) => {
        onFailure?.()
        throw error
      })
      .finally(() => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        refreshPromise = null
      })
    return refreshPromise
  }

  const schedule = () => {
    if (stopped) return
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void refresh().catch(() => undefined)
    }, debounceMs)
  }

  return {
    refresh,
    schedule,
    stop: () => {
      stopped = true
      if (refreshTimer) clearTimeout(refreshTimer)
    },
  }
}

export const POLL_INITIAL_DELAY_MS = 2_000
/** Cap while polls succeed but nothing changed. */
export const POLL_IDLE_MAX_DELAY_MS = 15_000
/** Cap while polls fail. */
export const POLL_MAX_DELAY_MS = 30_000
const FALLBACK_GRACE_MS = 5_000

export type PollOutcome = "changed" | "unchanged" | "failed"

/**
 * Next polling-fallback delay. Every poll is a Worker request that counts
 * against the plan's daily quota, so a quiet game must not poll at the
 * initial rate forever: only a version change resets to the fast cadence,
 * an unchanged poll backs off gently, and a failure backs off harder.
 */
export function nextPollDelayMs(previousMs: number, outcome: PollOutcome): number {
  if (outcome === "changed") return POLL_INITIAL_DELAY_MS
  if (outcome === "failed") return Math.min(POLL_MAX_DELAY_MS, previousMs * 2)
  return Math.min(POLL_IDLE_MAX_DELAY_MS, Math.round(previousMs * 1.5))
}

export function subscribeToGame<T extends VersionedGameState>(options: {
  gameId: string
  initialState: T | null
  fetchState: () => Promise<T>
  onState: (state: T) => void
  onConnectionChange?: (status: "connected" | "reconnecting") => void
  /** Anonymous guests MUST use the polling fallback for the entire game. */
  useChannel?: boolean
}): RealtimeController {
  let current = options.initialState
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null
  let pollInFlight = false
  let pollDelayMs = POLL_INITIAL_DELAY_MS
  let pollingFallback = options.useChannel === false
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
    ) return
    pollTimer = setTimeout(async () => {
      pollTimer = null
      if (stopped || (typeof document !== "undefined" && document.visibilityState === "hidden")) return
      pollInFlight = true
      const versionBefore = current?.version
      try {
        await coordinator.refresh()
        pollDelayMs = nextPollDelayMs(
          pollDelayMs,
          current?.version !== versionBefore ? "changed" : "unchanged",
        )
      } catch {
        pollDelayMs = nextPollDelayMs(pollDelayMs, "failed")
      } finally {
        pollInFlight = false
        schedulePolling()
      }
    }, pollDelayMs)
  }

  const startPolling = () => {
    if (stopped) return
    schedulePolling()
  }

  const coordinator = createRefreshCoordinator({
    refreshState: async () => {
      const incoming = await options.fetchState()
      const accepted = acceptAuthoritativeState(current, incoming)
      if (accepted && accepted !== current) {
        current = accepted
        options.onState(accepted)
        // A new version from outside the poll loop (own action, tab focus)
        // means play resumed: return to the fast cadence so the next reply
        // shows quickly. An in-flight poll applies its own "changed" outcome.
        if (pollingFallback && !pollInFlight && pollDelayMs !== POLL_INITIAL_DELAY_MS) {
          pollDelayMs = POLL_INITIAL_DELAY_MS
          if (pollTimer) {
            stopPolling()
            schedulePolling()
          }
        }
      }
    },
    onSuccess: () => {
      if (channelConnected && options.useChannel !== false) {
        pollingFallback = false
        stopPolling()
      }
      options.onConnectionChange?.("connected")
    },
    onFailure: () => {
      pollingFallback = true
      options.onConnectionChange?.("reconnecting")
      startPolling()
    },
  })

  const scheduleRefresh = () => coordinator.schedule()

  const handleRealtimeSignal = (payload?: { new?: { version?: unknown } | null }) => {
    const signalVersion = payload?.new?.version
    if (typeof signalVersion === "number" && current && signalVersion <= current.version) {
      return
    }
    scheduleRefresh()
  }

  let removeChannel = () => undefined
  let channelUnhealthy = false
  // Bumped on every (re)connect: status callbacks from a superseded channel
  // (e.g. the CLOSED emitted when the previous channel is removed) must not
  // overwrite the state of the current one.
  let channelGeneration = 0

  const connectChannel = () => {
    if (stopped || options.useChannel === false) return
    removeChannel()
    channelUnhealthy = false
    const generation = ++channelGeneration
    try {
      const supabase = createSupabaseBrowserClient()
      const channel = supabase
        .channel(uniqueChannelTopic(`game:${options.gameId}`))
        // Every supported game mutation increments game_sessions.version.
        // Subscribe only to the safe invalidation row, then refetch through
        // the authorized application API.
        .on("postgres_changes", { event: "*", schema: "public", table: "game_realtime_signals", filter: `game_id=eq.${options.gameId}` }, handleRealtimeSignal)
        .subscribe((status) => {
          if (stopped || generation !== channelGeneration) return
          if (status === "SUBSCRIBED") {
            if (fallbackTimer) clearTimeout(fallbackTimer)
            channelConnected = true
            channelUnhealthy = false
            pollingFallback = false
            stopPolling()
            options.onConnectionChange?.("connected")
            scheduleRefresh()
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (fallbackTimer) clearTimeout(fallbackTimer)
            channelConnected = false
            channelUnhealthy = true
            pollingFallback = true
            options.onConnectionChange?.("reconnecting")
            startPolling()
          }
        })
      removeChannel = () => {
        removeChannel = () => undefined
        void supabase.removeChannel(channel)
      }
    } catch {
      channelConnected = false
      channelUnhealthy = true
      pollingFallback = true
      options.onConnectionChange?.("reconnecting")
      startPolling()
    }
  }

  if (options.useChannel === false) {
    options.onConnectionChange?.("reconnecting")
    startPolling()
  } else {
    connectChannel()

    // A stalled channel may not emit an error callback. Keep a delayed fallback
    // so a healthy channel is not competing with polling during normal startup.
    if (typeof document === "undefined" || document.visibilityState !== "hidden") {
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null
        if (channelConnected) return
        pollingFallback = true
        startPolling()
      }, FALLBACK_GRACE_MS)
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      stopPolling()
      return
    }
    if (channelUnhealthy && options.useChannel !== false) {
      connectChannel()
    }
    void coordinator.refresh().catch(() => undefined)
    if (pollingFallback) startPolling()
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
