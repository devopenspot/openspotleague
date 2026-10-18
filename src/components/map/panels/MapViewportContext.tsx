"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { MapSpot } from "@/lib/types";

export interface MapViewportController {
  flyTo: (spot: MapSpot) => void;
  fitBoundsToVisibleItems: () => void;
  fitRadius: (radiusMeters: number) => void;
}

interface MapViewportContextValue {
  flyToSpot: (spot: MapSpot) => void;
  fitBoundsToVisibleItems: () => void;
  fitRadius: (radiusMeters: number) => void;
  registerController: (controller: MapViewportController | null) => void;
}

const MapViewportContext = createContext<MapViewportContextValue | null>(null);

export function MapViewportProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<MapViewportController | null>(null);

  const registerController = useCallback(
    (controller: MapViewportController | null) => {
      controllerRef.current = controller;
    },
    [],
  );

  const value = useMemo<MapViewportContextValue>(
    () => ({
      flyToSpot: (spot) => controllerRef.current?.flyTo(spot),
      fitBoundsToVisibleItems: () =>
        controllerRef.current?.fitBoundsToVisibleItems(),
      fitRadius: (radiusMeters) => controllerRef.current?.fitRadius(radiusMeters),
      registerController,
    }),
    [registerController],
  );

  return (
    <MapViewportContext.Provider value={value}>
      {children}
    </MapViewportContext.Provider>
  );
}

export function useMapViewport(): MapViewportContextValue {
  const context = useContext(MapViewportContext);
  if (!context) {
    throw new Error("useMapViewport must be used within a MapViewportProvider");
  }
  return context;
}
