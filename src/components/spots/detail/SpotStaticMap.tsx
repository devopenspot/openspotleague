"use client";

import { useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface SpotStaticMapProps {
  location: { lat: number; lon: number };
  name: string;
}

const LOCATION_PIN_HTML =
  '<span class="flex h-9 w-9 items-center justify-center rounded-full border border-map-primary bg-map-surface-container shadow-[0_0_12px_rgba(255,49,49,0.28)]">' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-map-primary-container" aria-hidden="true">' +
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>' +
  '<circle cx="12" cy="10" r="3"/>' +
  "</svg>" +
  "</span>";

export function SpotStaticMap({ location, name }: SpotStaticMapProps) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "leaflet-pin-wrapper",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: LOCATION_PIN_HTML,
      }),
    [],
  );

  return (
    <div className="map-theme-lighter absolute inset-0 isolate z-0 bg-map-surface">
      <MapContainer
        center={[location.lat, location.lon]}
        zoom={16}
        minZoom={2}
        maxZoom={18}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Marker
          position={[location.lat, location.lon]}
          icon={icon}
          interactive={false}
          keyboard={false}
          title={name}
          alt={name}
        />
      </MapContainer>
    </div>
  );
}
