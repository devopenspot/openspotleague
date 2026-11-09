import { describe, expect, it, vi, beforeEach } from "vitest"
import { acceptAuthoritativeState, createRefreshCoordinator } from "@/lib/games/realtime"
import { fetchGameState } from "@/components/games/hooks/useGameRealtime"

const { channelMock, createSupabaseBrowserClientMock } = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return {
    channelMock: channel,
    createSupabaseBrowserClientMock: vi.fn(() => ({
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    })),
  }
})

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => createSupabaseBrowserClientMock(),
  uniqueChannelTopic: (base: string) => base,
}))

describe("game realtime version handling", () => {
  it("ignores stale and duplicate state", () => {
    const current = { version: 4, status: "active" }
    expect(acceptAuthoritativeState(current, { version: 3, status: "lobby" })).toBe(current)
    expect(acceptAuthoritativeState(current, { version: 4, status: "complete" })).toBe(current)
  })

  it("accepts only newer authoritative state", () => {
    const current = { version: 4, status: "active" }
    const incoming = { version: 5, status: "complete" }
    expect(acceptAuthoritativeState(current, incoming)).toBe(incoming)
  })
})

describe("guest game reads", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
    }))
    vi.stubGlobal("localStorage", {
      getItem: () => "guesttoken0123456789ab",
    })
  })

  it("does not send the guest display name on state reads", async () => {
    await fetchGameState("game-1", "share-code", undefined, { authenticated: false })
    const request = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect(request.headers).toEqual({ "x-guest-token": "guesttoken0123456789ab" })
  })
})

describe("game realtime refresh coordination", () => {
  it("coalesces a burst of realtime events", async () => {
    vi.useFakeTimers()
    const refreshState = vi.fn().mockResolvedValue(undefined)
    const coordinator = createRefreshCoordinator({ refreshState })

    coordinator.schedule()
    coordinator.schedule()
    coordinator.schedule()
    await vi.advanceTimersByTimeAsync(74)
    expect(refreshState).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(refreshState).toHaveBeenCalledTimes(1)
    coordinator.stop()
    vi.useRealTimers()
  })

  it("queues one trailing refresh while a request is in flight", async () => {
    let resolveFirst: (() => void) | undefined
    let calls = 0
    const refreshState = vi.fn(
      () => {
        calls += 1
        if (calls > 1) return Promise.resolve()
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      },
    )
    const coordinator = createRefreshCoordinator({ refreshState })

    const first = coordinator.refresh()
    const trailing = coordinator.refresh()
    expect(refreshState).toHaveBeenCalledTimes(1)

    resolveFirst?.()
    await first
    await trailing
    expect(refreshState).toHaveBeenCalledTimes(2)
    coordinator.stop()
  })

  it("cancels a pending scheduled debounce when an explicit refresh runs", async () => {
    vi.useFakeTimers()
    const refreshState = vi.fn().mockResolvedValue(undefined)
    const coordinator = createRefreshCoordinator({ refreshState })

    coordinator.schedule()
    await coordinator.refresh()
    expect(refreshState).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(100)
    expect(refreshState).toHaveBeenCalledTimes(1)
    coordinator.stop()
    vi.useRealTimers()
  })

  it("times out a hung refresh so subsequent wake-up refreshes are not deadlocked", async () => {
    vi.useFakeTimers()
    let calls = 0
    const onFailure = vi.fn()
    const onSuccess = vi.fn()
    const refreshState = vi.fn(() => {
      calls += 1
      if (calls === 1) {
        return new Promise<void>(() => undefined)
      }
      return Promise.resolve()
    })
    const coordinator = createRefreshCoordinator({
      refreshState,
      onSuccess,
      onFailure,
      refreshTimeoutMs: 500,
    })

    const hung = coordinator.refresh()
    const hungAssertion = expect(hung).rejects.toThrow("Refresh timed out after 500ms")
    await vi.advanceTimersByTimeAsync(500)
    await hungAssertion
    expect(onFailure).toHaveBeenCalledTimes(1)

    await expect(coordinator.refresh()).resolves.toBeUndefined()
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(refreshState).toHaveBeenCalledTimes(2)
    coordinator.stop()
    vi.useRealTimers()
  })
})

describe("safe realtime subscriptions", () => {
  beforeEach(() => {
    channelMock.on.mockClear()
    channelMock.subscribe.mockClear()
    channelMock.on.mockReturnValue(channelMock)
    channelMock.subscribe.mockReturnValue(channelMock)
  })

  it("subscribes only to invalidation signals", async () => {
    const { subscribeToGame } = await import("@/lib/games/realtime")
    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 1 },
      fetchState: vi.fn().mockResolvedValue({ version: 2 }),
      onState: vi.fn(),
      useChannel: true,
    })

    expect(channelMock.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        table: "game_realtime_signals",
        filter: "game_id=eq.game-1",
      }),
      expect.any(Function),
    )
    controller.stop()
  })

  it("skips scheduled refetch when signal payload version is already known", async () => {
    vi.useFakeTimers()
    const { subscribeToGame } = await import("@/lib/games/realtime")
    const fetchState = vi.fn().mockResolvedValue({ version: 3 })
    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 2 },
      fetchState,
      onState: vi.fn(),
      useChannel: true,
    })

    const signalHandler = channelMock.on.mock.calls[0]?.[2] as (payload?: {
      new?: { version?: unknown }
    }) => void
    signalHandler({ new: { version: 1 } })
    signalHandler({ new: { version: 2 } })
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchState).not.toHaveBeenCalled()

    signalHandler({ new: { version: 3 } })
    await vi.advanceTimersByTimeAsync(75)
    expect(fetchState).toHaveBeenCalledTimes(1)

    controller.stop()
    vi.useRealTimers()
  })

  it("ignores status callbacks from a superseded channel after reconnecting", async () => {
    vi.useFakeTimers()
    const { subscribeToGame } = await import("@/lib/games/realtime")
    const onConnectionChange = vi.fn()
    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 1 },
      fetchState: vi.fn().mockResolvedValue({ version: 1 }),
      onState: vi.fn(),
      onConnectionChange,
      useChannel: true,
    })

    const firstCallback = channelMock.subscribe.mock.calls[0]?.[0] as (
      status: string,
    ) => void
    // First channel drops -> unhealthy; the next tab focus reconnects.
    firstCallback("CLOSED")
    document.dispatchEvent(new Event("visibilitychange"))
    expect(channelMock.subscribe).toHaveBeenCalledTimes(2)

    const secondCallback = channelMock.subscribe.mock.calls[1]?.[0] as (
      status: string,
    ) => void
    secondCallback("SUBSCRIBED")
    expect(onConnectionChange).toHaveBeenLastCalledWith("connected")

    // Late CLOSED from the removed first channel must not flip the healthy one.
    firstCallback("CLOSED")
    expect(onConnectionChange).toHaveBeenLastCalledWith("connected")

    controller.stop()
    vi.useRealTimers()
  })

  it("activates polling fallback when a refresh fails even after channel was subscribed", async () => {
    vi.useFakeTimers()
    const { subscribeToGame } = await import("@/lib/games/realtime")
    let attempt = 0
    const fetchState = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("network down")
      return { version: 2 }
    })
    const onConnectionChange = vi.fn()
    const onState = vi.fn()

    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 1 },
      fetchState,
      onState,
      onConnectionChange,
      useChannel: true,
    })

    const subscribeCallback = channelMock.subscribe.mock.calls[0]?.[0] as (
      status: string,
    ) => void
    subscribeCallback("SUBSCRIBED")

    // First scheduled refresh after SUBSCRIBED fails:
    await vi.advanceTimersByTimeAsync(75)
    expect(fetchState).toHaveBeenCalledTimes(1)
    expect(onConnectionChange).toHaveBeenLastCalledWith("reconnecting")

    // Polling fallback must be scheduled and recover on the next 2000ms tick:
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetchState).toHaveBeenCalledTimes(2)
    expect(onState).toHaveBeenCalledWith({ version: 2 })
    expect(onConnectionChange).toHaveBeenLastCalledWith("connected")

    controller.stop()
    vi.useRealTimers()
  })
})

describe("polling fallback back-off", () => {
  it("resets on change, backs off gently when unchanged and harder on failure", async () => {
    const { nextPollDelayMs, POLL_INITIAL_DELAY_MS, POLL_IDLE_MAX_DELAY_MS, POLL_MAX_DELAY_MS } =
      await import("@/lib/games/realtime")
    expect(nextPollDelayMs(12_000, "changed")).toBe(POLL_INITIAL_DELAY_MS)
    expect(nextPollDelayMs(2_000, "unchanged")).toBe(3_000)
    expect(nextPollDelayMs(14_000, "unchanged")).toBe(POLL_IDLE_MAX_DELAY_MS)
    expect(nextPollDelayMs(2_000, "failed")).toBe(4_000)
    expect(nextPollDelayMs(20_000, "failed")).toBe(POLL_MAX_DELAY_MS)
  })

  it("guest polling slows down while the game version does not change", async () => {
    vi.useFakeTimers()
    const { subscribeToGame } = await import("@/lib/games/realtime")
    const fetchState = vi.fn(async () => ({ version: 1 }))

    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 1 },
      fetchState,
      onState: vi.fn(),
      useChannel: false,
    })

    // 2s, then 3s, then 4.5s between polls.
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetchState).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2_999)
    expect(fetchState).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchState).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4_500)
    expect(fetchState).toHaveBeenCalledTimes(3)

    // Two quiet minutes at the 15s cap stay far below the old 2s cadence (60 polls).
    fetchState.mockClear()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchState.mock.calls.length).toBeLessThanOrEqual(12)

    controller.stop()
    vi.useRealTimers()
  })

  it("returns to the fast cadence when a poll brings a new version", async () => {
    vi.useFakeTimers()
    const { subscribeToGame } = await import("@/lib/games/realtime")
    let version = 1
    const fetchState = vi.fn(async () => ({ version }))

    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 1 },
      fetchState,
      onState: vi.fn(),
      useChannel: false,
    })

    await vi.advanceTimersByTimeAsync(2_000 + 3_000) // two unchanged polls, next in 4.5s
    expect(fetchState).toHaveBeenCalledTimes(2)
    version = 2
    await vi.advanceTimersByTimeAsync(4_500) // changed: next poll back at 2s
    expect(fetchState).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetchState).toHaveBeenCalledTimes(4)

    controller.stop()
    vi.useRealTimers()
  })
  it("returns to the fast cadence when a new version arrives outside the poll loop", async () => {
    vi.useFakeTimers()
    const { subscribeToGame } = await import("@/lib/games/realtime")
    let version = 1
    const fetchState = vi.fn(async () => ({ version }))

    const controller = subscribeToGame({
      gameId: "game-1",
      initialState: { version: 1 },
      fetchState,
      onState: vi.fn(),
      useChannel: false,
    })

    await vi.advanceTimersByTimeAsync(2_000 + 3_000 + 4_500) // three quiet polls, next in 6.75s
    expect(fetchState).toHaveBeenCalledTimes(3)

    // The player's own action refreshes and brings a new version.
    version = 2
    await controller.refresh()
    expect(fetchState).toHaveBeenCalledTimes(4)

    // The pending slow poll is replaced by one at the initial delay.
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetchState).toHaveBeenCalledTimes(5)

    controller.stop()
    vi.useRealTimers()
  })
})
