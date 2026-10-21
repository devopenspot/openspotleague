"use client";

import Link from "next/link";
import { Map, MapPin, Navigation, Swords } from "lucide-react";
import { setMapPreserveLocation } from "@/lib/map/preserve";
import type { Spot } from "@/lib/types";

interface SpotDetailsLocationProps {
  spot: Spot;
  gamePrefillHref: string;
  viewOnMapUrl: string;
  directionsUrl: string;
  wazeUrl: string;
}

export function SpotDetailsLocation({
  spot,
  gamePrefillHref,
  viewOnMapUrl,
  directionsUrl,
  wazeUrl,
}: SpotDetailsLocationProps) {
  return (
    <>
      <address className="py-4 not-italic">
        <span className="block font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
          Address
        </span>
        <span className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-on-surface">
          <MapPin size={15} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
          <span>{spot.address}</span>
        </span>
      </address>

      <div className="flex flex-col gap-2">
        <Link
          href={gamePrefillHref}
          aria-label={`Start training or challenge at ${spot.name}`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-5 text-xs font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span>Train / Challenge at this spot</span>
          <Swords size={12} aria-hidden="true" />
        </Link>
        <Link
          href={viewOnMapUrl}
          onClick={() => {
            setMapPreserveLocation();
          }}
          aria-label={`View ${spot.name} on the map`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span>View on map</span>
          <Map size={12} aria-hidden="true" />
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${spot.name} in Google Maps (opens in a new tab)`}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span>Google Maps</span>
            <MapPin size={12} aria-hidden="true" />
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open directions to ${spot.name} in Waze (opens in a new tab)`}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <span>Waze</span>
            <Navigation size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </>
  );
}
