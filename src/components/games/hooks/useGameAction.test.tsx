import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { useGameAction } from "@/components/games/hooks/useGameAction"

function response(body: unknown, ok: boolean, status: number) {
  return { ok, status, json: async () => body } as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("useGameAction", () => {
  it("does not send duplicate requests while an action is in flight", async () => {
    let resolveFetch: ((value: Response) => void) | undefined
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve })))
    const latestGameRef = { current: { id: "game-1", version: 1 } as never }
    const refreshGameState = vi.fn().mockResolvedValue({ status: "active", version: 2 })
    const setError = vi.fn()
    const { result } = renderHook(() => useGameAction({
      gameId: "game-1",
      latestGameRef,
      refreshGameState,
      setError,
    }))

    const first = result.current.action("/start")
    const second = await result.current.action("/start")
    resolveFetch?.(response({ id: "game-1", version: 2, status: "active" }, true, 200))
    await first

    expect(second).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it("clears a stale start error when refresh shows the game is already active", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ code: "INVALID_TRANSITION", error: "Only a lobby can start" }, false, 409)))
    const latestGameRef = { current: { id: "game-1", version: 2 } as never }
    const refreshGameState = vi.fn().mockResolvedValue({ status: "active", version: 3 })
    const setError = vi.fn()
    const { result } = renderHook(() => useGameAction({
      gameId: "game-1",
      latestGameRef,
      refreshGameState,
      setError,
    }))

    await result.current.action("/start")

    expect(refreshGameState).toHaveBeenCalledOnce()
    expect(setError).toHaveBeenLastCalledWith(null)
    expect(setError).not.toHaveBeenCalledWith("Only a lobby can start")
  })

  it("suppresses an error when refreshed state supersedes an action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      response({ code: "INVALID_TRANSITION", error: "Round has advanced" }, false, 409),
    ));
    const latestGameRef = {
      current: {
        id: "game-1",
        version: 2,
        currentRound: { id: "round-1", status: "verifying_location" },
      } as never,
    };
    const refreshGameState = vi.fn().mockResolvedValue({
      status: "active",
      version: 3,
      currentRound: { id: "round-2", status: "verifying_location" },
    });
    const setError = vi.fn();
    const { result } = renderHook(() => useGameAction({
      gameId: "game-1",
      latestGameRef,
      refreshGameState,
      setError,
    }));

    await result.current.action(
      "/rounds/round-1/location",
      {},
      { isSuperseded: (game) => game?.currentRound?.id !== "round-1" },
    );

    expect(setError).not.toHaveBeenCalledWith("Round has advanced");
  });

  it("submits combined challenge settings in one mutation and refreshes once", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      response({ id: "game-1", version: 2, trickId: "trick-1" }, true, 200),
    ))
    const latestGameRef = { current: { id: "game-1", version: 1 } as never }
    const refreshGameState = vi.fn().mockResolvedValue({ status: "active", version: 2 })
    const setError = vi.fn()
    const { result } = renderHook(() => useGameAction({
      gameId: "game-1",
      latestGameRef,
      refreshGameState,
      setError,
    }))

    await result.current.action("/rounds/round-1/challenge-settings", {
      spotType: "rails",
      level: 2,
    })

    expect(fetch).toHaveBeenCalledOnce()
    const request = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      expectedVersion: 1,
      spotType: "rails",
      level: 2,
    })
    expect(refreshGameState).toHaveBeenCalledOnce()
  })
})
