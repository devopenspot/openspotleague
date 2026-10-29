"use client";

import { useCallback, useEffect } from "react";
import {
  useUserLocationStore,
  NEARBY_RADIUS_OPTIONS,
  type NearbyRadiusMiles,
  type UserLocation,
  type UserLocationStatus,
  type UserLocationError,
} from "@/stores/user-location-store";
import { NEARBY_LOCATION_OPTIONS } from "@/lib/geo/options";

export interface UseUserLocationResult {
  status: UserLocationStatus;
  location: UserLocation | null;
  error: UserLocationError | null;
  radiusMiles: NearbyRadiusMiles;
  radiusOptions: readonly NearbyRadiusMiles[];
  setRadiusMiles: (miles: NearbyRadiusMiles) => void;
  request: () => Promise<UserLocationStatus>;
  clear: () => void;
}

function isValidRadius(value: number): value is NearbyRadiusMiles {
  return (NEARBY_RADIUS_OPTIONS as readonly number[]).includes(value);
}

let activeLocationRequest: Promise<UserLocationStatus> | null = null;
const GEOLOCATION_SAFETY_TIMEOUT_MS =
  (NEARBY_LOCATION_OPTIONS.timeout ?? 8_000) + 2_000;

function requestBrowserLocation(): Promise<UserLocationStatus> {
  if (activeLocationRequest) return activeLocationRequest;

  const request = performLocationRequest();
  activeLocationRequest = request;
  void request.then(
    () => {
      if (activeLocationRequest === request) activeLocationRequest = null;
    },
    () => {
      if (activeLocationRequest === request) activeLocationRequest = null;
    },
  );
  return request;
}

async function performLocationRequest(): Promise<UserLocationStatus> {
  if (typeof window === "undefined") return "unavailable";

  if (window.isSecureContext === false) {
    useUserLocationStore.getState().setUnavailable("insecure-context");
    return "unavailable";
  }

  const geolocation = window.navigator.geolocation;
  if (!geolocation) {
    useUserLocationStore.getState().setUnavailable("unsupported");
    return "unavailable";
  }

  useUserLocationStore.getState().setRequesting();

  return new Promise<UserLocationStatus>((resolve) => {
    let settled = false;
    const safetyTimer = setTimeout(() => {
      if (settled) return;
      useUserLocationStore.getState().setUnavailable("timeout");
      finish("unavailable");
    }, GEOLOCATION_SAFETY_TIMEOUT_MS);

    const finish = (next: UserLocationStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve(next);
    };

    const handleSuccess = (position: GeolocationPosition) => {
      if (settled) return;
      const latestStore = useUserLocationStore.getState();

      const { latitude, longitude, accuracy } = position.coords;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(accuracy)
      ) {
        latestStore.setUnavailable("position-unavailable");
        finish("unavailable");
        return;
      }

      latestStore.setGranted({
        lat: latitude,
        lon: longitude,
        accuracy,
      });
      finish("granted");
    };

    const handleError = (positionError: GeolocationPositionError) => {
      if (settled) return;
      const latestStore = useUserLocationStore.getState();
      if (positionError.code === positionError.PERMISSION_DENIED) {
        latestStore.setDenied();
        finish("denied");
        return;
      }

      latestStore.setUnavailable(
        positionError.code === positionError.TIMEOUT
          ? "timeout"
          : "position-unavailable",
      );
      finish("unavailable");
    };

    try {
      geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        NEARBY_LOCATION_OPTIONS,
      );
    } catch {
      useUserLocationStore.getState().setUnavailable("position-unavailable");
      finish("unavailable");
    }
  });
}

export function useUserLocation(): UseUserLocationResult {
  const status = useUserLocationStore((s) => s.status);
  const location = useUserLocationStore((s) => s.location);
  const error = useUserLocationStore((s) => s.error);
  const radiusMiles = useUserLocationStore((s) => s.radiusMiles);
  const setRadiusMilesRaw = useUserLocationStore((s) => s.setRadiusMiles);
  const clear = useUserLocationStore((s) => s.clear);

  // When user returns from OS settings after Allow, clear stale "denied" so explicit Try again reaches Geolocation API
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;
    let permissionChangeHandler: (() => void) | null = null;

    const resyncDenied = async () => {
      if (cancelled) return;
      const current = useUserLocationStore.getState().status;
      if (current !== "denied") return;
      if (!navigator.geolocation) return;
      const perms = "permissions" in navigator ? (navigator as Navigator & { permissions?: { query: (opts: { name: string }) => Promise<PermissionStatus> } }).permissions : undefined
      if (!perms?.query) return;
      try {
        const ps = await perms.query({ name: "geolocation" as PermissionName });
        if (cancelled) return;
        permissionStatus = ps;
        const handleChange = () => {
          if (cancelled) return;
          if (ps.state !== "denied") {
            useUserLocationStore.getState().clear();
          }
        };
        permissionChangeHandler = handleChange;
        ps.addEventListener("change", handleChange);
        if (ps.state !== "denied") {
          useUserLocationStore.getState().clear();
        }
      } catch {
        // Permissions API unavailable (some WKWebView builds) — keep denied and rely on explicit Try again
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void resyncDenied();
    };
    const onPageShow = () => void resyncDenied();
    const onFocus = () => void resyncDenied();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      if (permissionStatus && permissionChangeHandler) {
        try {
          permissionStatus.removeEventListener("change", permissionChangeHandler);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const setRadiusMiles = useCallback(
    (miles: NearbyRadiusMiles) => {
      if (!isValidRadius(miles)) return;
      setRadiusMilesRaw(miles);
    },
    [setRadiusMilesRaw],
  );

  const request = useCallback(
    (): Promise<UserLocationStatus> => requestBrowserLocation(),
    [],
  );

  return {
    status,
    location,
    error,
    radiusMiles,
    radiusOptions: NEARBY_RADIUS_OPTIONS,
    setRadiusMiles,
    request,
    clear,
  };
}
