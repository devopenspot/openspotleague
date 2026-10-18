"use client";

import Image from "next/image";
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { staticTileLayout, type PositionedTile } from "@/lib/map/static-tiles";

interface SpotMapFallbackProps {
  lat: number;
  lon: number;
  title: string;
  lens?: boolean;
  /** Scales the pin and shortens attribution for small thumbnails (search rows). */
  compact?: boolean;
}

const MAP_ZOOM = 16;
const MAP_WIDTH = 800;
// Tall enough for the popup's 220px desktop header; smaller containers clip.
const MAP_HEIGHT = 256;
const LENS_SCALE = 1.35;

function TileGrid({
  tiles,
  keyPrefix,
}: {
  tiles: PositionedTile[];
  keyPrefix: string;
}) {
  return (
    <>
      {tiles.map((t) => (
        <Image
          key={`${keyPrefix}${t.x}/${t.y}`}
          src={`https://tile.openstreetmap.org/${MAP_ZOOM}/${t.x}/${t.y}.png`}
          alt=""
          width={256}
          height={256}
          loading="lazy"
          decoding="async"
          draggable={false}
          unoptimized
          className="map-tile-dark pointer-events-none absolute select-none"
          style={{ left: t.left, top: t.top }}
        />
      ))}
    </>
  );
}

export function SpotMapFallback({
  lat,
  lon,
  title,
  lens = false,
  compact = false,
}: SpotMapFallbackProps) {
  const tiles = useMemo(
    () =>
      staticTileLayout({
        lat,
        lon,
        zoom: MAP_ZOOM,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
      }),
    [lat, lon],
  );

  return (
    <div aria-hidden="true" className="absolute inset-0 bg-map-surface">
      {/* Frame is centered so the spot lands exactly under the centered pin. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
      >
        <TileGrid tiles={tiles} keyPrefix="" />
      </div>

      {lens ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.3)] ring-1 ring-map-outline/60 md:h-24 md:w-24">
          <div className="absolute inset-0 [mask-image:radial-gradient(circle_closest-side,black_66%,transparent_100%)]">
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                transform: `translate(-50%, -50%) scale(${LENS_SCALE})`,
              }}
            >
              <TileGrid tiles={tiles} keyPrefix="lens-" />
            </div>
          </div>
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_36%_28%_at_30%_26%,rgba(255,255,255,0.35),transparent_70%)] bg-white/[0.06]" />
        </div>
      ) : null}

      <span
        title={title}
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-map-primary bg-map-surface-container shadow-[0_0_12px_rgba(255,49,49,0.28)] ${
          compact ? "h-6 w-6" : "h-9 w-9"
        }`}
      >
        <MapPin
          size={compact ? 12 : 16}
          className="text-map-primary-container"
          aria-hidden="true"
        />
      </span>
      <span className="absolute bottom-1 right-2 rounded border border-map-outline-variant bg-map-surface/85 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-map-secondary">
        {compact ? "© OSM" : "© OpenStreetMap"}
      </span>
    </div>
  );
}
