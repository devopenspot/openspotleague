"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { VERIFICATION_LOCATION_OPTIONS } from "@/lib/geo/options";
import type { GameState } from "@/lib/schemas/game";

type LocationPermission =
  | "unknown"
  | "granted"
  | "prompt"
  | "denied"
  | "unavailable";

type GameAction = (
  path: string,
  payload?: Record<string, unknown>,
  options?: { silentStale?: boolean; isSuperseded?: (game: GameState | null) => boolean },
) => Promise<{ ok: boolean; data: unknown } | null>;

const LOCATION_ROUND_STATUSES = new Set(["verifying_location", "paused"]);

function needsLocationVerification(game: GameState, roundId: string) {
  const round = game.currentRound;
  if (!round || round.id !== roundId) return false;
  const verification = round.verifications.find(
    (candidate) => candidate.playerId === game.viewerPlayerId,
  );
  if (!verification || verification.status !== "verified") return true;
  return (
    verification.expiresAt === null ||
    new Date(verification.expiresAt).getTime() <= Date.now()
  );
}

function canRequestLocation(
  game: GameState | null,
  roundId: string,
  force = false,
) {
  const round = game?.currentRound;
  const currentPlayer = game?.players.find(
    (player) => player.id === game.viewerPlayerId,
  );
  return Boolean(
    game &&
      round?.id === roundId &&
      game.mode === "challenge" &&
      LOCATION_ROUND_STATUSES.has(round.status) &&
      currentPlayer?.status === "active" &&
      (force || needsLocationVerification(game, roundId)),
  );
}

export function useLocationVerification({
  game,
  latestGameRef,
  action,
  setError,
}: {
  game: GameState | null;
  latestGameRef: MutableRefObject<GameState | null>;
  action: GameAction;
  setError: (message: string | null) => void;
}) {
  const [locationPending, setLocationPending] = useState(false);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermission>("unknown");
  const roundId = game?.currentRound?.id;
  const roundStatus = game?.currentRound?.status;
  const shouldRequestLocation = Boolean(
    game && roundId && needsLocationVerification(game, roundId),
  );
  const currentPlayerStatus = game?.players.find(
    (player) => player.id === game.viewerPlayerId,
  )?.status;
  const locationRequestRef = useRef(false);
  const attemptedLocationRoundRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestLocation = useCallback(
    (roundId: string, force = false) => {
      const currentGame = latestGameRef.current;
      if (
        !mountedRef.current ||
        !canRequestLocation(currentGame, roundId, force)
      ) return;
      if (!navigator.geolocation || locationRequestRef.current) return;

      locationRequestRef.current = true;
      attemptedLocationRoundRef.current = roundId;
      setLocationPending(true);
      const clearRequest = () => {
        locationRequestRef.current = false;
        if (mountedRef.current) setLocationPending(false);
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!mountedRef.current) {
            clearRequest();
            return;
          }
          const locationPayload = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          };
          const currentGame = latestGameRef.current;
          if (!canRequestLocation(currentGame, roundId, force)) {
            clearRequest();
            return;
          }
          void action(`/rounds/${roundId}/location`, locationPayload, {
            silentStale: true,
            isSuperseded: (refreshedGame) =>
              !canRequestLocation(
                refreshedGame ?? latestGameRef.current,
                roundId,
                force,
              ),
            })
            .then(async (result) => {
              const errorCode = !result?.ok ? (result?.data as { code?: string })?.code : undefined;
              if (errorCode === "STALE_VERSION") {
                if (
                  !canRequestLocation(latestGameRef.current, roundId, force)
                ) {
                  return { ok: true as const, data: { status: "superseded" } } as unknown as typeof result;
                }
                const retry = await action(`/rounds/${roundId}/location`, locationPayload, {
                  silentStale: true,
                  isSuperseded: (refreshedGame) =>
                    !canRequestLocation(
                      refreshedGame ?? latestGameRef.current,
                      roundId,
                      force,
                    ),
                });
                const retryCode = !retry?.ok ? (retry?.data as { code?: string })?.code : undefined;
                return retryCode === "STALE_VERSION"
                  ? ({ ok: true as const, data: { status: "superseded" } } as unknown as typeof retry)
                  : retry;
              }
              return result;
            })
            .then((result) => {
              if (!mountedRef.current) return;
              if (
                !result?.ok &&
                !canRequestLocation(latestGameRef.current, roundId, force)
              ) {
                return;
              }
              if (result?.ok && (result.data as { status?: string })?.status === "rejected") {
                const reason = (result.data as { reason?: string | null })?.reason;
                setError(
                  reason === "too_far"
                    ? "You are too far from this spot to verify the round."
                    : "Your GPS accuracy is not sufficient to verify this round.",
                );
              } else if (!result?.ok) {
                setError(
                  "Location verification could not be completed. Try again.",
                );
              }
            })
            .finally(clearRequest);
        },
        (positionError) => {
          clearRequest();
          if (!mountedRef.current) return;
          if (positionError.code === positionError.PERMISSION_DENIED) {
            setLocationPermission("denied");
            setError(
              "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.",
            );
          } else {
            setError(
              positionError.code === positionError.TIMEOUT
                ? "Location lookup timed out. Try again where you have a clearer signal."
                : "Your location is temporarily unavailable. Try again.",
            );
          }
        },
        VERIFICATION_LOCATION_OPTIONS,
      );
    },
    [action, latestGameRef, setError],
  );

  useEffect(() => {
    if (
      !roundId ||
      !LOCATION_ROUND_STATUSES.has(roundStatus ?? "") ||
      currentPlayerStatus !== "active" ||
      !shouldRequestLocation
    ) return;

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const inspectPermission = async () => {
      if (!navigator.geolocation) {
        if (!cancelled) setLocationPermission("unavailable");
        return undefined;
      }

      try {
        permissionStatus = await navigator.permissions.query({
          name: "geolocation",
        });
      } catch {
        if (!cancelled) setLocationPermission("prompt");
        return undefined;
      }

      if (cancelled) return undefined;
      const updatePermission = () => {
        if (!permissionStatus || cancelled) return;
        const next = permissionStatus.state as Exclude<
          LocationPermission,
          "unknown" | "unavailable"
        >;
        setLocationPermission(next);
        if (
          next === "granted" &&
          attemptedLocationRoundRef.current !== roundId
        ) {
          requestLocation(roundId);
        }
      };

      permissionStatus.addEventListener("change", updatePermission);
      updatePermission();
      return () => permissionStatus?.removeEventListener("change", updatePermission);
    };

    let cleanup: (() => void) | undefined;
    void inspectPermission().then((removeListener) => {
      cleanup = removeListener;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    currentPlayerStatus,
    locationPending,
    roundId,
    roundStatus,
    requestLocation,
    shouldRequestLocation,
  ]);

  // iOS WKWebView stale cache: re-query permission when tab becomes visible again
  useEffect(() => {
    if (
      !roundId ||
      !LOCATION_ROUND_STATUSES.has(roundStatus ?? "") ||
      currentPlayerStatus !== "active"
    ) return;

    let cancelled = false;

    const resyncPermission = async () => {
      if (cancelled || !mountedRef.current) return;
      if (!navigator.geolocation || !navigator.permissions?.query) return;
      try {
        const ps = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        if (cancelled || !mountedRef.current) return;
        const next = ps.state as LocationPermission;
        // Update state directly; permission change listener covers future changes
        setLocationPermission((prev) => (prev !== next ? next : prev));
      } catch {
        // Permissions API not available on this iOS WebView
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void resyncPermission();
    };

    const onPageShow = () => void resyncPermission();
    const onFocus = () => void resyncPermission();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentPlayerStatus, roundId, roundStatus]);

  const verifyLocation = useCallback(() => {
    const currentPlayer = game?.players.find(
      (player) => player.id === game.viewerPlayerId,
    );
    if (!game?.currentRound || currentPlayer?.status !== "active") return;
    if (!navigator.geolocation) {
      setLocationPermission("unavailable");
      setError("This browser does not provide location access.");
      return;
    }
    // Do not optimistically set to granted; let success/error drive state
    requestLocation(game.currentRound.id, true);
  }, [game, requestLocation, setError]);

  return {
    locationPending,
    locationPermission,
    verifyLocation,
  };
}
