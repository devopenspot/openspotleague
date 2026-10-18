import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const NEARBY_RADIUS_OPTIONS = [10, 25, 50, 100] as const;
export type NearbyRadiusMiles = (typeof NEARBY_RADIUS_OPTIONS)[number];
export const DEFAULT_NEARBY_RADIUS_MI: NearbyRadiusMiles = 25;

export type UserLocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

export type UserLocationError =
  | "insecure-context"
  | "unsupported"
  | "position-unavailable"
  | "timeout";

export interface UserLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

interface UserLocationState {
  status: UserLocationStatus;
  location: UserLocation | null;
  error: UserLocationError | null;
  setRequesting: () => void;
  setGranted: (loc: UserLocation) => void;
  setDenied: () => void;
  setUnavailable: (error: UserLocationError) => void;
  radiusMiles: NearbyRadiusMiles;
  setRadiusMiles: (miles: NearbyRadiusMiles) => void;
  clear: () => void;
}

export const useUserLocationStore = create<UserLocationState>()(
  devtools(
    (set) => ({
      status: "idle",
      location: null,
      error: null,
      setRequesting: () => set({ status: "requesting", error: null }),
      radiusMiles: DEFAULT_NEARBY_RADIUS_MI,
      setGranted: (loc) =>
        set({
          status: "granted",
          location: loc,
          error: null,
        }),
      setDenied: () =>
        set({
          status: "denied",
          location: null,
          error: null,
        }),
      setUnavailable: (error) =>
        set({
          status: "unavailable",
          error,
        }),
      setRadiusMiles: (miles) => set({ radiusMiles: miles }),
      clear: () =>
        set({
          status: "idle",
          location: null,
          error: null,
        }),
    }),
    {
      name: "UserLocationStore",
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);
