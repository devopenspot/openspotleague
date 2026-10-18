"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap, useMapEvent } from "react-leaflet";
import L from "leaflet";
import { log } from "@/lib/utils/log";
import type { MapViewportPoint } from "@/components/map/shared/map-derived";
import {
  useMapViewport,
  type MapViewportController,
} from "@/components/map/panels/MapViewportContext";

const FOCUS_ZOOM = 13;
const FLY_DURATION_SEC = 0.6;
const FIT_PADDING: [number, number] = [40, 40];
const RADIUS_FIT_MAX_ZOOM = 16;
// Bounds fits zoom in only far enough to keep tiny selections (1-2 spots
// metres apart) readable instead of maxing out at street level (zoom ~18).
const FIT_BOUNDS_MAX_ZOOM = 15;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function safeMapCall(
  map: L.Map,
  action: () => void,
  isActive: () => boolean = () => true,
): void {
  if (!map || !isActive()) return;
  map.whenReady(() => {
    if (typeof window === "undefined" || !isActive()) return;
    window.requestAnimationFrame(() => {
      try {
        const container = map.getContainer();
        if (!isActive() || !container.isConnected) return;
        const size = map.getSize();
        if (size.x === 0 || size.y === 0) return;
        action();
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          log.warn("[leaflet] safe call skipped:", error as unknown as never);
        }
      }
    });
  });
}

function flyOrSetView(
  map: L.Map,
  target: L.LatLngExpression,
  zoom: number,
  isActive: () => boolean,
): void {
  safeMapCall(map, () => {
    if (prefersReducedMotion()) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: FLY_DURATION_SEC });
  }, isActive);
}

function flyBoundsOrSetView(
  map: L.Map,
  bounds: L.LatLngBoundsExpression,
  isActive: () => boolean,
): void {
  safeMapCall(map, () => {
    if (prefersReducedMotion()) {
      map.fitBounds(bounds, {
        padding: FIT_PADDING,
        maxZoom: FIT_BOUNDS_MAX_ZOOM,
      });
    } else {
      map.flyToBounds(bounds, {
        padding: FIT_PADDING,
        maxZoom: FIT_BOUNDS_MAX_ZOOM,
        duration: FLY_DURATION_SEC,
      });
    }
  }, isActive);
}

export function MapController({
  viewportPoints,
  userLocation,
  disableInitialFit = false,
}: {
  viewportPoints: readonly MapViewportPoint[];
  userLocation: { lat: number; lon: number; accuracy: number } | null;
  disableInitialFit?: boolean;
}) {
  const map = useMap();
  const hasInitialFit = useRef(false);
  const isMounted = useRef(true);
  const { registerController } = useMapViewport();
  const controller = useMemo<MapViewportController>(
    () => ({
      flyTo: (spot) =>
        flyOrSetView(
          map,
          [spot.location.lat, spot.location.lon],
          FOCUS_ZOOM,
          () => isMounted.current,
        ),
      fitBoundsToVisibleItems: () => {
        if (viewportPoints.length === 0) return;
        if (viewportPoints.length === 1 && viewportPoints[0]) {
          flyOrSetView(
            map,
            viewportPoints[0],
            FOCUS_ZOOM,
            () => isMounted.current,
          );
          return;
        }
        flyBoundsOrSetView(
          map,
          [...viewportPoints],
          () => isMounted.current,
        );
      },
      fitRadius: (radiusMeters) => {
        if (!userLocation || !Number.isFinite(radiusMeters) || radiusMeters <= 0) return;
        const bounds = L.latLng(userLocation.lat, userLocation.lon).toBounds(radiusMeters * 2);
        safeMapCall(map, () => {
          const options = {
            padding: FIT_PADDING,
            maxZoom: RADIUS_FIT_MAX_ZOOM,
            duration: FLY_DURATION_SEC,
          };
          if (prefersReducedMotion()) map.fitBounds(bounds, options);
          else map.flyToBounds(bounds, options);
        }, () => isMounted.current);
      },
    }),
    [map, viewportPoints, userLocation],
  );

  useEffect(() => {
    isMounted.current = true;
    registerController(controller);
    return () => registerController(null);
  }, [controller, registerController]);

  useEffect(() => () => {
    isMounted.current = false;
  }, []);

  useEffect(() => {
    if (disableInitialFit) return;
    if (viewportPoints.length === 0 || hasInitialFit.current || userLocation) return;
    hasInitialFit.current = true;
    const first = viewportPoints[0];
    if (viewportPoints.length === 1 && first) {
      safeMapCall(map, () =>
        map.setView(first, FOCUS_ZOOM),
        () => isMounted.current,
      );
      return;
    }
    safeMapCall(map, () =>
      map.fitBounds(
        [...viewportPoints],
        { padding: FIT_PADDING, maxZoom: FIT_BOUNDS_MAX_ZOOM },
      ),
      () => isMounted.current,
    );
  }, [disableInitialFit, map, viewportPoints, userLocation]);

  return null;
}

export function ZoomListener({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useMapEvent("zoomend", () => onZoomChange(map.getZoom()));
  return null;
}
