"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import type { MapSpot, Region, SpotTypeEntity } from "@/lib/types";
import { useSpotsStore } from "@/stores/spots-store";
import { useEventsStore } from "@/stores/events-store";
import type { MapEvent } from "@/types/sport-events";

export type MapDataAvailability = "ready" | "degraded";

export interface MapDataStatus {
  spots: MapDataAvailability;
  events: MapDataAvailability;
}

const DEFAULT_MAP_DATA_STATUS: MapDataStatus = {
  spots: "ready",
  events: "ready",
};
const EMPTY_MAP_EVENTS: readonly MapEvent[] = [];

const MapDataStatusContext = createContext<MapDataStatus>(DEFAULT_MAP_DATA_STATUS);

export function useMapDataStatus(): MapDataStatus {
  return useContext(MapDataStatusContext);
}

export function MapProvider({
  children,
  initialSpots,
  initialRegions,
  initialSpotTypes,
  initialEvents,
  dataStatus,
}: {
  children: ReactNode;
  initialSpots: readonly MapSpot[];
  initialRegions?: readonly Region[];
  initialSpotTypes?: readonly SpotTypeEntity[];
  initialEvents?: readonly MapEvent[];
  dataStatus: MapDataStatus;
}) {
  const setSpots = useSpotsStore((s) => s.setSpots);
  const setRegions = useSpotsStore((s) => s.setRegions);
  const setSpotTypes = useSpotsStore((s) => s.setSpotTypes);
  const setEvents = useEventsStore((s) => s.setEvents);
  const resolvedInitialEvents = initialEvents ?? EMPTY_MAP_EVENTS;

  useEffect(() => {
    setSpots(initialSpots);
    if (initialRegions) setRegions(initialRegions);
    if (initialSpotTypes) setSpotTypes(initialSpotTypes);
    setEvents(resolvedInitialEvents);
  }, [
    initialRegions,
    initialSpots,
    initialSpotTypes,
    resolvedInitialEvents,
    setEvents,
    setRegions,
    setSpotTypes,
    setSpots,
  ]);

  // Note: `RootLayout`'s `RootDataProviders` (`SpotsProvider`) already
  // wraps the app in `UserProvider`, `WeatherProvider`,
  // `SavedSpotsProvider`, `VerifiedSpotsProvider`, and `HydrationGate`,
  // and hydrates `regions` and `spotTypes`. `MapProvider` only owns
  // the map spot working set, map events, and `MapDataStatusContext`.
  return (
    <MapDataStatusContext.Provider value={dataStatus}>
      {children}
    </MapDataStatusContext.Provider>
  );
}
