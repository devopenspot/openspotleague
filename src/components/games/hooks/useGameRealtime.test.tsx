import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/lib/schemas/game";

const { fetchMock, parseMock, subscribeMock, stopMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  parseMock: vi.fn(),
  subscribeMock: vi.fn(),
  stopMock: vi.fn(),
}));

vi.mock("@/lib/utils/fetch-timeout", () => ({
  DEFAULT_READ_TIMEOUT_MS: 1000,
  fetchWithTimeout: fetchMock,
}));

vi.mock("@/lib/schemas/game", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  gameStateSchema: { parse: parseMock },
}));

vi.mock("@/lib/games/realtime", () => ({
  acceptAuthoritativeState: (_: unknown, incoming: unknown) => incoming,
  subscribeToGame: subscribeMock,
}));

import { useGameRealtime } from "@/components/games/hooks/useGameRealtime";

const game = { id: "game-1", version: 3 } as unknown as GameState;
const okResponse = {
  status: 200,
  ok: true,
  json: async () => game,
};

beforeEach(() => {
  fetchMock.mockReset();
  subscribeMock.mockReset();
  stopMock.mockReset();
  parseMock.mockReset();
  parseMock.mockImplementation((value: unknown) => value);
  subscribeMock.mockReturnValue({
    refresh: vi.fn(async () => undefined),
    stop: stopMock,
  });
});

describe("useGameRealtime", () => {
  it("subscribes after a successful first load", async () => {
    fetchMock.mockResolvedValue(okResponse);
    const { result } = renderHook(() => useGameRealtime("game-1"));

    await waitFor(() => expect(result.current.game).toEqual(game));

    expect(subscribeMock).toHaveBeenCalledOnce();
  });

  it("goes live when Try again succeeds after a failed first load", async () => {
    fetchMock.mockRejectedValueOnce(new Error("no signal"));
    const { result } = renderHook(() => useGameRealtime("game-1"));

    await waitFor(() => expect(result.current.error).toBe("no signal"));
    expect(subscribeMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(okResponse);
    await act(async () => {
      await result.current.refreshGameState();
    });

    expect(result.current.game).toEqual(game);
    expect(result.current.error).toBeNull();
    expect(subscribeMock).toHaveBeenCalledOnce();
  });

  it("does not subscribe twice on later refreshes", async () => {
    fetchMock.mockResolvedValue(okResponse);
    const { result } = renderHook(() => useGameRealtime("game-1"));
    await waitFor(() => expect(result.current.game).toEqual(game));

    await act(async () => {
      await result.current.refreshGameState();
    });

    expect(subscribeMock).toHaveBeenCalledOnce();
  });

  it("stops the subscription on unmount", async () => {
    fetchMock.mockResolvedValue(okResponse);
    const { result, unmount } = renderHook(() => useGameRealtime("game-1"));
    await waitFor(() => expect(result.current.game).toEqual(game));

    unmount();

    expect(stopMock).toHaveBeenCalledOnce();
  });
});
