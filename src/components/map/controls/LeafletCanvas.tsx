"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { log } from "@/lib/utils/log";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { MapSpot } from "@/lib/types";
import { useMapStore } from "@/stores/map-store";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";
import { useTemperatureUnit } from "@/hooks/preferences/useTemperatureUnit";
import { useWeather } from "@/components/shell/WeatherContext";
import { useSpotsWeather } from "@/hooks/data/useSpotWeather";
import { useMapLayer } from "@/hooks/map/useMapLayer";
import { milesToMeters } from "@/lib/spots/geo";
import { SpotMarker } from "@/components/map/markers/SpotMarker";
import { EventMarker } from "@/components/map/markers/EventMarker";
import type { MapEvent } from "@/types/sport-events";
import { MapController, ZoomListener } from "@/components/map/controls/LeafletMapController";
import { buildRenderedMapItems, deriveMapViewportPoints } from "@/components/map/shared/map-derived";

const USER_FOCUS_ZOOM = 12;
const CITY_FOCUS_ZOOM = 13;

const CLUSTER_ZOOM_MAX = 6;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildClusterHTML(count: number, typeLabel: string): string {
  return (
    `<div class="leaflet-cluster">` +
    `<span class="leaflet-cluster__chip" title="${count} ${escapeHtml(typeLabel)} spots">` +
    `+${count}` +
    `</span>` +
    `</div>`
  );
}

function makeIcon(
  html: string,
  size: [number, number],
  anchor: [number, number],
): L.DivIcon {
  return L.divIcon({
    className: "leaflet-pin-wrapper",
    iconSize: size,
    iconAnchor: anchor,
    html,
  });
}

function ClusterMarker({
  item,
  onSelect,
}: {
  item: Extract<
    ReturnType<typeof buildRenderedMapItems>[number],
    { kind: "cluster" }
  >;
  onSelect: (spot: MapSpot) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);
  const accessibleLabel = `${item.count} ${item.label} spots in this area`;
  const handleSelect = () => {
    const bounds = item.spots.map(
      (spot) => [spot.location.lat, spot.location.lon] as [number, number],
    );
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
    const first = item.spots[0];
    if (first) onSelect(first);
  };

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", accessibleLabel);
  }, [accessibleLabel, item.key]);

  const handleKeyDown = (event: L.LeafletKeyboardEvent) => {
    if (
      event.originalEvent.key !== " " &&
      event.originalEvent.key !== "Enter"
    ) {
      return;
    }
    event.originalEvent.preventDefault();
    event.originalEvent.stopPropagation();
    handleSelect();
  };

  return (
    <Marker
      ref={markerRef}
      position={item.position}
      icon={makeIcon(
        buildClusterHTML(item.count, item.label),
        [48, 48],
        [14, 14],
      )}
      keyboard
      zIndexOffset={100}
      title={accessibleLabel}
      alt={accessibleLabel}
      eventHandlers={{ click: handleSelect, keydown: handleKeyDown }}
    />
  );
}

function VisibleWeatherLoader({
  spots,
  enabled,
}: {
  spots: readonly MapSpot[];
  enabled: boolean;
}) {
  const map = useMap();
  const setWeatherFetching = useMapStore((s) => s.setWeatherFetching);
  const [viewportVersion, setViewportVersion] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    moveend: () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setViewportVersion((v) => v + 1), 100);
    },
    zoomend: () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setViewportVersion((v) => v + 1), 100);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const visibleIds = useMemo(() => {
    if (!enabled) return null;
    void viewportVersion;
    const bounds = map.getBounds().pad(0.15);
    return spots
      .filter((spot) => bounds.contains([spot.location.lat, spot.location.lon]))
      .map((spot) => spot.id);
  }, [enabled, map, spots, viewportVersion]);
  const { isFetching } = useSpotsWeather(visibleIds);

  useEffect(() => {
    setWeatherFetching(isFetching);
  }, [isFetching, setWeatherFetching]);

  return null;
}

interface LeafletCanvasProps {
  spots: readonly MapSpot[];
  events?: readonly MapEvent[];
  initialCenter?: [number, number];
  initialZoom?: number;
  disableInitialFit?: boolean;
  selectedCity?: string | null;
  cityCenter?: [number, number] | null;
}

function MapCityRecenterController({
  selectedCity,
  cityCenter,
}: {
  selectedCity?: string | null;
  cityCenter?: [number, number] | null;
}) {
  const map = useMap();
  const lastCenteredCityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedCity) {
      lastCenteredCityRef.current = null;
      return;
    }

    if (!cityCenter) return;
    if (lastCenteredCityRef.current === selectedCity) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const performRecenter = () => {
      try {
        const container = map.getContainer();
        if (!container || !container.isConnected) return;
        const size = map.getSize();
        if (size.x === 0 || size.y === 0) return;

        lastCenteredCityRef.current = selectedCity;

        const currentZoom = map.getZoom();
        const currentCenter = map.getCenter();
        const isAlreadyCentered =
          currentZoom === CITY_FOCUS_ZOOM &&
          Math.abs(currentCenter.lat - cityCenter[0]) < 0.0001 &&
          Math.abs(currentCenter.lng - cityCenter[1]) < 0.0001;

        if (isAlreadyCentered) return;

        if (prefersReducedMotion) {
          map.setView(cityCenter, CITY_FOCUS_ZOOM);
        } else {
          map.flyTo(cityCenter, CITY_FOCUS_ZOOM, { duration: 0.6 });
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          log.warn("[leaflet] city recenter failed:", error as unknown as never);
        }
      }
    };

    map.whenReady(() => {
      if (typeof window === "undefined") return;
      window.requestAnimationFrame(performRecenter);
    });
  }, [cityCenter, map, selectedCity]);

  return null;
}

class LeafletErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV === "development") {
      log.warn("[leaflet] recovered from:", error.message as unknown as never);
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <button
          type="button"
          onClick={this.props.onRetry}
          className="flex h-full w-full items-center justify-center bg-map-surface font-display text-xs font-bold uppercase tracking-wider text-map-on-surface hover:bg-map-surface-container transition-colors"
        >
          Map paused — click to retry
        </button>
      );
    }
    return this.props.children;
  }
}

export function LeafletCanvas({
  spots,
  events,
  initialCenter,
  initialZoom,
  disableInitialFit = false,
  selectedCity,
  cityCenter,
}: LeafletCanvasProps) {
  const activeId = useMapStore((s) => s.activePinId);
  const activeEventId = useMapStore((s) => s.activeEventId);
  const toggleActivePin = useMapStore((s) => s.toggleActivePin);
  const setActivePin = useMapStore((s) => s.setActivePin);
  const toggleActiveEvent = useMapStore((s) => s.toggleActiveEvent);
  const { location: userLocation, radiusMiles } = useUserLocation();
  const user = useUser();
  const { savedIds } = useSavedSpots(user?.id ?? null);
  const { weather } = useWeather();
  const distanceUnit = useDistanceUnit();
  const temperatureUnit = useTemperatureUnit();
  const { isEnabled } = useMapLayer();

  const showSpots = isEnabled("spots");
  const showEvents = isEnabled("events") && (events?.length ?? 0) > 0;
  const enabledLayers = useMemo(() => {
    const layers = new Set<"spots" | "events">();
    if (showSpots) layers.add("spots");
    if (showEvents) layers.add("events");
    return layers;
  }, [showEvents, showSpots]);
  const viewportPoints = useMemo(
    () => deriveMapViewportPoints(spots, events ?? [], enabledLayers),
    [enabledLayers, events, spots],
  );

  const initialZoomState = initialZoom ?? (userLocation ? USER_FOCUS_ZOOM : 2);
  const initialCenterState: [number, number] =
    initialCenter ??
    (userLocation ? [userLocation.lat, userLocation.lon] : [20, 0]);
  const [zoom, setZoom] = useState<number>(initialZoomState);
  const [resetKey, setResetKey] = useState(0);
  const items = useMemo(
    () =>
      showSpots ? buildRenderedMapItems(spots, zoom, CLUSTER_ZOOM_MAX) : [],
    [showSpots, spots, zoom],
  );

  // Weather loading is handled inside the mounted Leaflet map so requests
  // follow the current viewport instead of the entire filtered dataset.
  const isWeatherEnabled = useMapStore((s) => s.isWeatherEnabled);
  const userNearby = useMemo(() => {
    if (!userLocation) return false;
    for (const s of spots) {
      const dLat = s.location.lat - userLocation.lat;
      const dLon = s.location.lon - userLocation.lon;
      if (dLat * dLat + dLon * dLon < 0.000001) return true;
    }
    return false;
  }, [spots, userLocation]);

  const userIcon = useMemo(() => {
    return L.divIcon({
      className: `leaflet-user-pin ${userNearby ? "leaflet-user-pin--nearby" : ""}`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html:
        '<span class="leaflet-user-pin__ring" aria-hidden="true" />' +
        '<span class="leaflet-user-pin__dot" aria-hidden="true" />',
    });
  }, [userNearby]);

  const showCircle =
    userLocation !== null && typeof radiusMiles === "number" && radiusMiles > 0;
  const radiusMeters =
    userLocation !== null ? milesToMeters(radiusMiles) : undefined;

  const handleEventClick = (event: MapEvent) => {
    toggleActiveEvent(event.id);
  };

  return (
    <LeafletErrorBoundary
      key={resetKey}
      onRetry={() => setResetKey((k) => k + 1)}
    >
      <MapContainer
        key={resetKey}
        center={initialCenterState}
        zoom={initialZoomState}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom
        worldCopyJump
        zoomControl={false}
        className="h-full w-full"
        attributionControl
      >
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <VisibleWeatherLoader
          spots={spots}
          enabled={isWeatherEnabled && showSpots}
        />
        <MapController
          viewportPoints={viewportPoints}
          userLocation={userLocation}
          disableInitialFit={disableInitialFit}
        />
        <MapCityRecenterController
          selectedCity={selectedCity}
          cityCenter={cityCenter}
        />
        <ZoomListener onZoomChange={setZoom} />
        {items.map((item) =>
          item.kind === "spot" ? (
            <SpotMarker
              key={item.key}
              spot={item.spot}
              isActive={activeId === item.spot.id}
              isSaved={savedIds.has(item.spot.id)}
              showWeather={isWeatherEnabled}
              weather={weather[item.spot.id]}
              userLocation={
                userLocation
                  ? { lat: userLocation.lat, lon: userLocation.lon }
                  : null
              }
              distanceUnit={distanceUnit}
              temperatureUnit={temperatureUnit}
              onClick={(spot) => toggleActivePin(spot.id)}
            />
          ) : (
            <ClusterMarker
              key={item.key}
              item={item}
              onSelect={(spot) => setActivePin(spot.id)}
            />
          ),
        )}
        {showEvents &&
          (events ?? []).map((event) => (
            <EventMarker
              key={event.id}
              event={event}
              isActive={activeEventId === event.id}
              onClick={handleEventClick}
            />
          ))}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lon]}
            icon={userIcon}
            interactive={false}
            keyboard={false}
            title="Your location"
            alt="Your current location"
          />
        )}
        {showCircle && userLocation && radiusMeters !== undefined && (
          <Circle
            center={[userLocation.lat, userLocation.lon]}
            radius={radiusMeters}
            pathOptions={{
              color: "#82ddf7",
              weight: 1.5,
              opacity: 0.85,
              fillColor: "#36b1d0",
              fillOpacity: 0.14,
              dashArray: "6 4",
            }}
          />
        )}
      </MapContainer>
    </LeafletErrorBoundary>
  );
}
