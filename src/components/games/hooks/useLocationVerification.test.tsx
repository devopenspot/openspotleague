import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/lib/schemas/game";
import { useLocationVerification } from "@/components/games/hooks/useLocationVerification";

const FUTURE_EXPIRY = "2099-01-01T00:00:00.000Z";

let geolocationDescriptor: PropertyDescriptor | undefined;
let permissionsDescriptor: PropertyDescriptor | undefined;
let locationSuccess:
  | ((position: GeolocationPosition) => void)
  | undefined;
const getCurrentPositionMock = vi.fn();
const permissionsQueryMock = vi.fn();

function game({
  roundId = "round-1",
  roundStatus = "verifying_location",
  verificationStatus = "pending",
  expiresAt = null,
}: {
  roundId?: string;
  roundStatus?: string;
  verificationStatus?: string;
  expiresAt?: string | null;
} = {}) {
  return {
    id: "game-1",
    mode: "challenge",
    viewerPlayerId: "player-1",
    players: [{ id: "player-1", status: "active" }],
    currentRound: {
      id: roundId,
      status: roundStatus,
      verifications: [
        {
          playerId: "player-1",
          status: verificationStatus,
          distanceMeters: null,
          accuracyMeters: null,
          verifiedAt: null,
          expiresAt,
        },
      ],
    },
  } as unknown as GameState;
}

function position() {
  return {
    coords: {
      latitude: 40.4168,
      longitude: -3.7038,
      accuracy: 12,
    },
  } as GeolocationPosition;
}

function installBrowserMocks() {
  locationSuccess = undefined;
  getCurrentPositionMock.mockImplementation(
    (success: (value: GeolocationPosition) => void) => {
      locationSuccess = success;
    },
  );
  const permissionStatus = {
    state: "granted",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  permissionsQueryMock.mockResolvedValue(permissionStatus);

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: getCurrentPositionMock },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: permissionsQueryMock },
  });
}

beforeEach(() => {
  geolocationDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "geolocation",
  );
  permissionsDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "permissions",
  );
  getCurrentPositionMock.mockReset();
  permissionsQueryMock.mockReset();
  installBrowserMocks();
});

afterEach(() => {
  cleanup();
  if (geolocationDescriptor) {
    Object.defineProperty(navigator, "geolocation", geolocationDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
  if (permissionsDescriptor) {
    Object.defineProperty(navigator, "permissions", permissionsDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "permissions");
  }
});

describe("useLocationVerification", () => {
  it("does not automatically re-submit a valid verification", async () => {
    const currentGame = game({
      verificationStatus: "verified",
      expiresAt: FUTURE_EXPIRY,
    });
    const action = vi.fn();
    const latestGameRef = { current: currentGame };

    renderHook(() =>
      useLocationVerification({
        game: currentGame,
        latestGameRef,
        action,
        setError: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(permissionsQueryMock).not.toHaveBeenCalled();
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("drops a GPS result when the round has already advanced", async () => {
    const currentGame = game();
    const latestGameRef = { current: currentGame };
    const action = vi.fn();

    renderHook(() =>
      useLocationVerification({
        game: currentGame,
        latestGameRef,
        action,
        setError: vi.fn(),
      }),
    );

    await waitFor(() =>
      expect(getCurrentPositionMock).toHaveBeenCalledOnce(),
    );
    latestGameRef.current = game({ roundId: "round-2" });

    await act(async () => {
      locationSuccess?.(position());
      await Promise.resolve();
    });

    expect(action).not.toHaveBeenCalled();
  });

  it("refreshes and retries once after a stale version", async () => {
    const currentGame = game();
    const latestGameRef = { current: currentGame };
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, data: { code: "STALE_VERSION" } })
      .mockResolvedValueOnce({ ok: true, data: { status: "verified" } });
    const setError = vi.fn();

    renderHook(() =>
      useLocationVerification({
        game: currentGame,
        latestGameRef,
        action,
        setError,
      }),
    );

    await waitFor(() =>
      expect(getCurrentPositionMock).toHaveBeenCalledOnce(),
    );
    await act(async () => {
      locationSuccess?.(position());
      await Promise.resolve();
    });

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(setError).not.toHaveBeenCalled();
  });

  it("treats a second stale response as superseded instead of an error", async () => {
    const currentGame = game();
    const latestGameRef = { current: currentGame };
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, data: { code: "STALE_VERSION" } })
      .mockResolvedValueOnce({ ok: false, data: { code: "STALE_VERSION" } });
    const setError = vi.fn();

    renderHook(() =>
      useLocationVerification({
        game: currentGame,
        latestGameRef,
        action,
        setError,
      }),
    );

    await waitFor(() =>
      expect(getCurrentPositionMock).toHaveBeenCalledOnce(),
    );
    await act(async () => {
      locationSuccess?.(position());
      await Promise.resolve();
    });

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(setError).not.toHaveBeenCalled();
  });
});
