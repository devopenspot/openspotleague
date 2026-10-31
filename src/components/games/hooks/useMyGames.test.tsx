import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMyGames,
  useResumableGame,
} from "@/components/games/hooks/useMyGames";
import { GUEST_TOKEN_STORAGE_KEY } from "@/lib/games/guest";
import type { GameListItem } from "@/lib/schemas/game";

const fetchMock = vi.fn();

const listItem = (id: string, status: string) =>
  ({
    id,
    status,
    shareCode: "code",
    mode: "training",
    disciplineSlug: "skateboard",
    gameName: `Game ${id}`,
    spotId: null,
    scheduledStartAt: null,
    nextSpotType: "ledge",
    version: 1,
    updatedAt: "2030-01-01T12:05:00.000Z",
  }) as GameListItem;

const json = (body: unknown, ok = true) => ({ ok, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

describe("useMyGames", () => {
  it("starts loading, then reports the games", async () => {
    fetchMock.mockResolvedValue(json([listItem("a", "active")]));
    const { result } = renderHook(() => useMyGames({ limit: 5 }));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.games).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/games?limit=5");
  });

  it("tells a failed load apart from having no games", async () => {
    fetchMock.mockResolvedValue(json({}, false));
    const { result } = renderHook(() => useMyGames({ limit: 5 }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.games).toEqual([]);
  });

  it("does not fetch when the caller already has the games", () => {
    renderHook(() => useMyGames({ limit: 5, enabled: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useResumableGame", () => {
  it("picks the first unfinished game for a signed-in rider", () => {
    const { result } = renderHook(() =>
      useResumableGame({
        signedIn: true,
        games: [
          listItem("done", "complete"),
          listItem("live", "active"),
          listItem("older", "lobby"),
        ],
      }),
    );

    expect(result.current).toEqual({
      id: "live",
      gameName: "Game live",
      status: "active",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers nothing when every game has finished", () => {
    const { result } = renderHook(() =>
      useResumableGame({ signedIn: true, games: [listItem("done", "cancelled")] }),
    );
    expect(result.current).toBeNull();
  });

  it("finds a guest's open game with their token", async () => {
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, "a".repeat(24));
    fetchMock.mockResolvedValue(
      json([
        {
          id: "guest-game",
          version: 1,
          status: "lobby",
          mode: "training",
          disciplineSlug: "skateboard",
          gameName: "Guest Game",
          nextSpotType: "ledge",
          updatedAt: "2030-01-01T12:05:00.000Z",
        },
      ]),
    );

    const { result } = renderHook(() =>
      useResumableGame({ signedIn: false, games: [] }),
    );

    await waitFor(() => expect(result.current?.id).toBe("guest-game"));
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { "x-guest-token": "a".repeat(24) },
    });
  });

  it("does not ask the server about a guest with no token", () => {
    const { result } = renderHook(() =>
      useResumableGame({ signedIn: false, games: [] }),
    );
    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
