"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { MapSpot } from "@/lib/types";
import type { SpotWeather } from "@/lib/weather/weather-cached";
import type { DistanceUnit, TemperatureUnit } from "@/stores/preferences-store";
import { getSpotDistanceInfo } from "@/lib/spots/geo";
import {
  buildSpotPinHTML,
  getPinDimensions,
  pinOptionsFromWeather,
} from "@/components/map/markers/spot-marker-rendering";
import { MAP_DISTANCE_UI_ENABLED } from "@/components/map/shared/map-feature-flags";

interface SpotMarkerProps {
  spot: MapSpot;
  isActive: boolean;
  isSaved: boolean;
  showWeather: boolean;
  weather: SpotWeather | undefined;
  userLocation: { lat: number; lon: number } | null;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  onClick: (spot: MapSpot) => void;
}

export const SpotMarker = memo(function SpotMarker({
  spot,
  isActive,
  isSaved,
  showWeather,
  weather,
  userLocation,
  distanceUnit,
  temperatureUnit,
  onClick,
}: SpotMarkerProps) {
  const markerRef = useRef<L.Marker>(null);
  const distanceInfo = getSpotDistanceInfo(spot, userLocation, distanceUnit);
  const showDistance =
    MAP_DISTANCE_UI_ENABLED && distanceInfo.kind === "distance";
  const options = useMemo(
    () =>
      pinOptionsFromWeather(
        {
          active: isActive,
          saved: isSaved,
          showDistance,
          distanceLabel: showDistance ? distanceInfo.label : "",
          name: spot.name,
        },
        weather,
        temperatureUnit,
      ),
    [
      distanceInfo.label,
      isActive,
      isSaved,
      showDistance,
      spot.name,
      temperatureUnit,
      weather,
    ],
  );

  const icon = useMemo(() => {
    const renderOptions = { ...options, weather: showWeather ? options.weather : null };
    const html = buildSpotPinHTML(renderOptions);
    const dimensions = getPinDimensions(isActive, showWeather, showDistance);

    return L.divIcon({
      className: "leaflet-pin-wrapper",
      iconSize: dimensions.size,
      iconAnchor: dimensions.anchor,
      html,
    });
  }, [isActive, options, showDistance, showWeather]);

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", `Open ${spot.name}`);
  }, [spot.name, icon]);

  const handleKeyDown = (event: L.LeafletKeyboardEvent) => {
    if (event.originalEvent.key !== " " && event.originalEvent.key !== "Enter") {
      return;
    }
    event.originalEvent.preventDefault();
    event.originalEvent.stopPropagation();
    onClick(spot);
  };

  return (
    <Marker
      ref={markerRef}
      position={[spot.location.lat, spot.location.lon]}
      icon={icon}
      zIndexOffset={isActive ? 1000 : isSaved ? 200 : 0}
      eventHandlers={{ click: () => onClick(spot), keydown: handleKeyDown }}
      keyboard
      title={spot.name}
      alt={spot.name}
    />
  );
})
