"use client";

import Link from "next/link";
import { Map, MapPin, Navigation, Swords } from "lucide-react";
import { setMapPreserveLocation } from "@/lib/map/preserve";
import type { Spot } from "@/lib/types";
import { controlClass, EYEBROW } from "@/components/ui/recipes";

const LOCATION_PRIMARY_LINK_CLASS = controlClass("primary");
const LOCATION_SECONDARY_LINK_CLASS = controlClass("secondary");
const LOCATION_EXTERNAL_LINK_CLASS = controlClass("outline");

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
        <span className={`block ${EYEBROW}`}>
          Address
        </span>
        <span className="mt-2 flex items-start gap-2 text-sm font-semibold leading-5 text-on-surface">
          <MapPin size={15} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
          <span>{spot.address}</span>
        </span>
      </address>

      <div className="flex flex-col gap-2">
        <Link
          href={gamePrefillHref}
          aria-label={`Start training or challenge at ${spot.name}`}
          className={LOCATION_PRIMARY_LINK_CLASS}
        >
          <span>Train / Challenge at this spot</span>
          <Swords size={14} aria-hidden="true" className="shrink-0" />
        </Link>
        <Link
          href={viewOnMapUrl}
          onClick={() => {
            setMapPreserveLocation();
          }}
          aria-label={`View ${spot.name} on the map`}
          className={LOCATION_SECONDARY_LINK_CLASS}
        >
          <span>View on map</span>
          <Map size={14} aria-hidden="true" className="shrink-0" />
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${spot.name} in Google Maps (opens in a new tab)`}
            className={LOCATION_EXTERNAL_LINK_CLASS}
          >
            <span>Google Maps</span>
            <MapPin size={14} aria-hidden="true" className="shrink-0" />
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open directions to ${spot.name} in Waze (opens in a new tab)`}
            className={LOCATION_EXTERNAL_LINK_CLASS}
          >
            <span>Waze</span>
            <Navigation size={14} aria-hidden="true" className="shrink-0" />
          </a>
        </div>
      </div>
    </>
  );
}
