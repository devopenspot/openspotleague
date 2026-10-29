"use client";

import { AppImage } from "@/components/ui/AppImage";
import { ArrowRight, MapPin } from "lucide-react";
import { TypeBadges } from "@/components/spots/shared/TypeBadges";
import { SpotMapFallback } from "@/components/spots/card/SpotMapFallback";
import {
  SEARCH_MATCH_INITIAL_CHUNK,
  SEARCH_MATCH_STEP_CHUNK,
} from "@/lib/config/constants";
import { useProgressiveList } from "@/hooks/ui/useProgressiveList";
import type { MapSpot } from "@/lib/types";

export function GateNotice({ id }: { id: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="mx-auto mb-4 w-full max-w-3xl rounded-[12px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-on-surface"
    >
      <p className="font-display text-xs font-bold uppercase tracking-widest text-primary">
        Region, country &amp; city required
      </p>
      <p className="mt-1 text-secondary">
        Filtered map is gated until you pick a region, a country and a city.
        Search for a city or spot above, or choose a region below to load the
        map.
      </p>
    </div>
  );
}

export interface MatchedCityItem {
  slug: string;
  name: string;
  admin1?: string | null;
  spotCount?: number;
  country?: string;
  region?: string;
}

export interface MatchedCitiesProps {
  cities: readonly MatchedCityItem[];
  onPickCity: (city: MatchedCityItem) => void;
}

export function MatchedCities({ cities, onPickCity }: MatchedCitiesProps) {
  if (cities.length === 0) return null;
  return (
    <div className="mb-6 space-y-3">
      <h3 className="font-display text-xs font-bold tracking-widest text-secondary uppercase">
        Matched cities ({cities.length})
      </h3>
      <ul className="space-y-2" aria-label="Matched cities">
        {cities.map((city) => {
          const title = city.admin1
            ? `${city.name}, ${city.admin1}`
            : city.name;
          const subtitle = [city.country, city.region]
            .filter(Boolean)
            .join(" · ");
          const spotCount =
            typeof city.spotCount === "number" && city.spotCount > 0
              ? city.spotCount
              : null;
          return (
            <li key={`${city.country ?? ""}:${city.slug}`}>
              <button
                type="button"
                onClick={() => onPickCity(city)}
                className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-3 text-left transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-low text-secondary">
                    <MapPin size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-bold tracking-wide uppercase">
                      {title}
                    </span>
                    {subtitle ? (
                      <span className="block truncate text-xs text-secondary">
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {spotCount !== null && (
                    <span className="font-display text-xs font-bold tracking-widest text-secondary uppercase">
                      {spotCount} {spotCount === 1 ? "spot" : "spots"}
                    </span>
                  )}
                  <ArrowRight
                    size={14}
                    className="opacity-60 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface MatchedSpotsProps {
  query: string;
  spots: readonly MapSpot[];
  /** True while the debounced server text-search request is in flight. */
  searching?: boolean;
  onPick: (spot: MapSpot) => void;
  distanceLabel: (spot: MapSpot) => string;
}

export function MatchedSpots({
  query,
  spots,
  searching = false,
  onPick,
  distanceLabel,
}: MatchedSpotsProps) {
  // Progressive render: the map route matches against the scoped dataset
  // (base directory ∪ full-country overlay, up to thousands of rows) with
  // no server cap, so a broad query would otherwise mount thousands of
  // image-bearing rows at once. Short lists render fully, identically.
  // The header count stays the full match count.
  const { visible, hasMore, sentinelRef } = useProgressiveList(spots, {
    initial: SEARCH_MATCH_INITIAL_CHUNK,
    step: SEARCH_MATCH_STEP_CHUNK,
  });

  return (
    <div className="space-y-4">
      <h3
        aria-live="polite"
        aria-atomic="true"
        className="mb-3 font-display text-xs font-bold tracking-widest text-secondary uppercase"
      >
        {searching
          ? "Searching…"
          : `Matched spots (${spots.length})`}
      </h3>

      {visible.length > 0 ? (
        <ul className="space-y-3" aria-label="Matched spots">
          {visible.map((spot) => {
            const distance = distanceLabel(spot);
            return (
              <li key={spot.id}>
                <button
                  type="button"
                  onClick={() => onPick(spot)}
                  className="flex min-h-20 w-full items-center gap-4 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-3 text-left transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
                >
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-on-surface">
                    {spot.image?.trim() ? (
                      <AppImage
                        src={spot.image}
                        alt={spot.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    ) : (
                      <SpotMapFallback
                        lat={spot.location.lat}
                        lon={spot.location.lon}
                        title={spot.name}
                        compact
                      />
                    )}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="mb-1 flex items-center justify-between gap-2 font-display text-xs text-secondary">
                      {spot.types.length > 0 ? (
                        <TypeBadges
                          types={spot.types}
                          variant="surface"
                          className="[&_span]:rounded-[8px] [&_span]:px-2 [&_span]:py-1 [&_span]:text-xs"
                        />
                      ) : null}
                      {distance ? <span>{distance}</span> : null}
                    </span>
                    <span className="block truncate font-display text-lg font-bold tracking-wide uppercase">
                      {spot.name}
                    </span>
                    <span className="mt-1 flex items-center text-xs text-on-surface-variant">
                      <MapPin
                        size={11}
                        className="mr-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      {spot.city}
                    </span>
                  </span>

                  <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {hasMore && (
            <li ref={sentinelRef} aria-hidden="true" className="h-0" />
          )}
        </ul>
      ) : (
        <div className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low p-8 text-center font-display text-sm text-secondary">
          No spots found for &ldquo;
          {query.toUpperCase()}&rdquo;
        </div>
      )}
    </div>
  );
}
