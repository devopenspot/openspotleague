"use client";

import { useCallback, useState } from "react";

export type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export interface UserLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (): Promise<LocationStatus> => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      setError("Geolocation is not supported in this browser.");
      return "unavailable";
    }
    setStatus("requesting");
    setError(null);
    return new Promise<LocationStatus>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setStatus("granted");
          setError(null);
          resolve("granted");
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied");
            setError("Location permission denied. Enable it in your browser settings to add a spot.");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setStatus("unavailable");
            setError("Location unavailable. Try again outdoors with GPS enabled.");
          } else {
            setStatus("unavailable");
            setError(err.message || "Could not get your location.");
          }
          resolve(err.code === 1 ? "denied" : "unavailable");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setLocation(null);
    setError(null);
  }, []);

  return { status, location, error, request, reset };
}
