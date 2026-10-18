"use client";

import { useEffect, type ReactNode } from "react";
import type { Region, SpotTypeEntity } from "@/lib/types";
import type { SpotWeather } from "@/lib/weather/weather-cached";
import type { User } from "@/lib/auth/user";
import {
  useSpotsStore,
} from "@/stores/spots-store";
import { HydrationGate } from "@/components/shell/HydrationGate";
import { WeatherProvider } from "./WeatherContext";
import { UserProvider } from "@/lib/contexts/user-context";
import {
  SavedSpotsProvider,
  type InitialSavedSpot,
} from "@/lib/contexts/saved-spots-context";
import {
  VerifiedSpotsProvider,
  type InitialVerifiedSpot,
} from "@/lib/contexts/verified-spots-context";
import { AppShell } from "./AppShell";

export function SpotsProvider({
  children,
  initialRegions,
  initialSpotTypes,
  initialWeather,
  initialUser,
  initialSavedSpots,
  initialVerifiedSpots,
}: {
  children: ReactNode;
  initialRegions: readonly Region[];
  initialSpotTypes: readonly SpotTypeEntity[];
  initialWeather: Record<string, SpotWeather>;
  initialUser: User | null;
  initialSavedSpots?: readonly InitialSavedSpot[];
  initialVerifiedSpots?: readonly InitialVerifiedSpot[];
}) {
  // Catalog-only hydration. The root layout must not write the
  // `spots` slice: the map route's MapProvider owns that working
  // set (its effect — a child of this provider — runs first, so a
  // `setMapData` here would wipe the map's hydrated directory).
  // Callers needing DB spot truth fetch server-side (suggested
  // spots, explore counts) or via the public API (search overlay).
  const setRegions = useSpotsStore((s) => s.setRegions);
  const setSpotTypes = useSpotsStore((s) => s.setSpotTypes);

  useEffect(() => {
    setRegions(initialRegions);
    setSpotTypes(initialSpotTypes);
  }, [initialRegions, initialSpotTypes, setRegions, setSpotTypes]);

  return (
    <UserProvider user={initialUser}>
      <WeatherProvider initialWeather={initialWeather}>
        <SavedSpotsProvider initial={initialSavedSpots ?? []}>
          <VerifiedSpotsProvider initial={initialVerifiedSpots ?? []}>
            <HydrationGate>
              <AppShell>{children}</AppShell>
            </HydrationGate>
          </VerifiedSpotsProvider>
        </SavedSpotsProvider>
      </WeatherProvider>
    </UserProvider>
  );
}
