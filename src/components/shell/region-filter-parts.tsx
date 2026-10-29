"use client";

import { useMemo, useState } from "react";
import { AppImage } from "@/components/ui/AppImage";
import { ArrowLeft, ArrowRight, Globe, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  SEARCH_CITY_INITIAL_CHUNK,
  SEARCH_CITY_STEP_CHUNK,
} from "@/lib/config/constants";
import { useProgressiveList } from "@/hooks/ui/useProgressiveList";
import type { Region } from "@/lib/types";
import type { CityOption } from "@/hooks/map/useMapFilter";

export interface RegionListProps {
  regions: readonly Region[];
  region: string | null;
  onPick: (name: string) => void;
}

export function RegionList({ regions, region, onPick }: RegionListProps) {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between border-b border-outline-variant pb-4">
        <h3 className="flex items-center gap-2 font-display text-xs font-bold tracking-widest text-secondary uppercase">
          <Globe size={12} aria-hidden="true" />
          Browse by region
        </h3>
        <span
          aria-hidden="true"
          className="font-display text-xs font-bold tracking-widest text-secondary uppercase"
        >
          Step 01 / 03
        </span>
      </header>

      <ul role="list" className="space-y-2" aria-label="Available regions">
        {regions.map((r) => {
          const active = region === r.name;
          return (
            <li key={r.name}>
              <button
                type="button"
                onClick={() => onPick(r.name)}
                aria-pressed={active}
                className={cn(
                  "group flex min-h-20 w-full items-stretch overflow-hidden rounded-[16px] border text-left transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                  active
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant bg-surface-container-lowest hover:border-outline hover:bg-surface-container-highest",
                )}
              >
                {r.image ? (
                  <span
                    aria-hidden="true"
                    className="relative h-20 w-20 shrink-0 overflow-hidden border-r border-outline-variant bg-on-surface"
                  >
                    <AppImage
                      src={r.image}
                      alt={r.name}
                      fill
                      sizes="80px"
                      className={cn(
                        "object-cover",
                        active
                          ? "opacity-90"
                          : "opacity-70 group-hover:opacity-90",
                      )}
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  </span>
                ) : null}

                <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-bold tracking-wide uppercase truncate">
                      {r.name}
                    </span>
                    <span className="shrink-0 font-display text-xs font-bold tracking-widest uppercase opacity-70">
                      {r.count}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-6 line-clamp-2",
                      active
                        ? "text-surface/80"
                        : "text-secondary group-hover:text-surface/80",
                    )}
                  >
                    {r.desc}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className="flex items-center justify-center border-l border-outline-variant px-3 opacity-60 transition-opacity group-hover:opacity-100"
                >
                  <ArrowRight size={14} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface CountryDrillDownProps {
  region: Region;
  countries: readonly string[];
  country: string | null;
  countryCount: ReadonlyMap<string, number>;
  eventCountByCountry?: ReadonlyMap<string, number>;
  isPicker: boolean;
  onBack: () => void;
  onPick: (name: string) => void;
  /** Scope selector: the region-level CTA commits a region-wide selection. */
  onViewAll: (scope: "region" | "country") => void;
}

export function CountryDrillDown({
  region,
  countries,
  country,
  countryCount,
  eventCountByCountry,
  isPicker,
  onBack,
  onPick,
  onViewAll,
}: CountryDrillDownProps) {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between border-b border-outline-variant pb-4">
        {isPicker ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-1 rounded-[9999px] px-3 py-2 font-display text-xs font-bold tracking-widest text-secondary uppercase hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-offset-2"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            All regions
          </button>
        ) : (
          <span className="font-display text-xs font-bold tracking-widest text-secondary uppercase">
            Filter by country
          </span>
        )}
        <span
          aria-hidden="true"
          className="font-display text-xs font-bold tracking-widest text-secondary uppercase"
        >
          Step 02 / 03
        </span>
      </header>

      <div className="space-y-1">
        <h3 className="font-display text-2xl font-bold tracking-wide uppercase text-on-surface">
          {region.name}
        </h3>
        <p className="max-w-prose text-sm leading-6 text-secondary">
          {region.desc}
        </p>
      </div>

      {isPicker && (
        <button
          type="button"
          onClick={() => onViewAll("region")}
          className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-[9999px] border border-primary bg-primary p-3 text-left text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-2 active:translate-y-px"
        >
          <span className="font-display text-sm font-bold tracking-wide uppercase">
            View all {region.name} spots
          </span>
          <ArrowRight
            size={14}
            className="opacity-60 group-hover:opacity-100"
            aria-hidden="true"
          />
        </button>
      )}

      {countries.length > 0 ? (
        <ul
          role="list"
          className="space-y-1.5"
          aria-label={`Countries in ${region.name}`}
        >
          {countries.map((c) => {
            const active = country === c;
            // Server-truth counts from the regions catalog when present
            // (uncapped DB aggregate); the client-derived map from
            // `allSpots` is only a fallback because that list is
            // page-capped at SPOT_LIST_HARD_CAP and undercounts most
            // countries.
            const count = region.countryCounts?.[c] ?? countryCount.get(c) ?? 0;
            const eventCount = eventCountByCountry?.get(c);
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  // Picker mode keeps the active row clickable: re-clicking
                  // re-enters the city list for the staged country.
                  disabled={!isPicker && active}
                  aria-pressed={active}
                  className={cn(
                    "group flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border p-3 text-left transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container-lowest hover:border-outline hover:bg-surface-container-highest",
                  )}
                >
                  <span className="font-display text-sm font-bold tracking-wide uppercase truncate">
                    {c}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span
                      className={cn(
                        "font-display text-xs font-bold tracking-widest uppercase",
                        active
                          ? "text-surface/80"
                          : "text-secondary group-hover:text-surface/80",
                      )}
                    >
                      {count} {count === 1 ? "spot" : "spots"}
                      {typeof eventCount === "number" && ` · ${eventCount} ${eventCount === 1 ? "event" : "events"}`}
                    </span>
                    <ArrowRight
                      size={12}
                      className="opacity-60 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low p-4 text-center font-display text-xs font-bold tracking-widest text-secondary uppercase">
          No countries in this region yet
        </p>
      )}
    </div>
  );
}

export interface CityDrillDownProps {
  country: string;
  cities: readonly CityOption[];
  city: string | null;
  /**
   * True while the server-truth city list is in flight (the client-derived
   * list may be a capped-directory sliver — e.g. one stale city — so the
   * list is withheld rather than presenting incomplete data). Renders the
   * honest loading pill; back navigation stays available.
   */
  citiesPending: boolean;
  isPicker: boolean;
  onBack: () => void;
  onPick: (slug: string) => void;
  /**
   * No-cities escape (empty state only): the mandatory-city gate has no
   * regular exit when the merged city list is empty, so committing the
   * country-wide scope has to happen here.
   */
  onCommitCountryAll: () => void;
}

export function CityDrillDown({
  country,
  cities,
  city,
  citiesPending,
  isPicker,
  onBack,
  onPick,
  onCommitCountryAll,
}: CityDrillDownProps) {
  const [cityFilter, setCityFilter] = useState("");
  const filteredCities = useMemo(() => {
    const trimmed = cityFilter.trim().toLowerCase();
    if (!trimmed) return cities;
    const normalizedFilter = trimmed
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return cities.filter((option) => {
      const label = option.admin1
        ? `${option.name}, ${option.admin1}`
        : option.name;
      const normalizedLabel = label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return (
        normalizedLabel.includes(normalizedFilter) ||
        option.slug.includes(normalizedFilter) ||
        (option.admin1?.toLowerCase() ?? "") === normalizedFilter
      );
    });
  }, [cities, cityFilter]);

  // Quiet-city countries (US, France, Germany, Australia…) surface hundreds
  // of small cities; the list reveals in chunks past the initial one so the
  // step's first paint stays light. Short lists render fully, identically.
  const { visible: visibleCities, hasMore, sentinelRef } = useProgressiveList(
    filteredCities,
    {
      initial: SEARCH_CITY_INITIAL_CHUNK,
      step: SEARCH_CITY_STEP_CHUNK,
    },
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between border-b border-outline-variant pb-4">
        {isPicker ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-1 rounded-[9999px] px-3 py-2 font-display text-xs font-bold tracking-widest text-secondary uppercase hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-offset-2"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            All countries
          </button>
        ) : (
          <span className="font-display text-xs font-bold tracking-widest text-secondary uppercase">
            Filter by city
          </span>
        )}
        <span
          aria-hidden="true"
          className="font-display text-xs font-bold tracking-widest text-secondary uppercase"
        >
          Step 03 / 03
        </span>
      </header>

      <h3 className="font-display text-2xl font-bold tracking-wide uppercase text-on-surface">
        {country}
      </h3>

      {!citiesPending && cities.length > 8 && (
        <div className="flex items-center gap-2.5 rounded-[16px] border border-outline-variant bg-surface-container-lowest px-3.5 py-2">
          <Search
            size={15}
            className="shrink-0 text-secondary"
            aria-hidden="true"
          />
          <input
            type="text"
            autoComplete="off"
            aria-label={`Filter cities in ${country}`}
            placeholder={`Filter cities in ${country}...`}
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full bg-transparent text-base text-on-surface outline-none placeholder:text-secondary sm:text-sm"
          />
          {cityFilter && (
            <button
              type="button"
              onClick={() => setCityFilter("")}
              aria-label="Clear city filter"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-surface-container-high hover:text-on-surface"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {citiesPending ? (
        <p className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low p-4 text-center font-display text-xs font-bold tracking-widest text-secondary uppercase">
          Loading cities&hellip;
        </p>
      ) : visibleCities.length > 0 ? (
        <ul role="list" className="space-y-1.5" aria-label={`Cities in ${country}`}>
          {visibleCities.map((option) => {
            const active = city === option.slug;
            const displayLabel = option.admin1
              ? `${option.name}, ${option.admin1}`
              : option.name;
            const spotCount =
              typeof option.spotCount === "number" && option.spotCount > 0
                ? option.spotCount
                : null;
            return (
              <li key={option.slug}>
                <button
                  type="button"
                  onClick={() => onPick(option.slug)}
                  disabled={active}
                  aria-pressed={active}
                  className={cn(
                    "group flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border p-3 text-left transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container-lowest hover:border-outline hover:bg-surface-container-highest",
                  )}
                >
                  <span className="font-display text-sm font-bold tracking-wide uppercase truncate">
                    {displayLabel}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    {spotCount !== null && (
                      <span
                        className={cn(
                          "font-display text-xs font-bold tracking-widest uppercase",
                          active
                            ? "text-surface/80"
                            : "text-secondary group-hover:text-surface/80",
                        )}
                      >
                        {spotCount} {spotCount === 1 ? "spot" : "spots"}
                      </span>
                    )}
                    <ArrowRight
                      size={12}
                      className="opacity-60 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            );
          })}
          {hasMore && (
            <li ref={sentinelRef} aria-hidden="true" className="h-0" />
          )}
        </ul>
      ) : cities.length > 0 ? (
        <p className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low p-4 text-center font-display text-xs font-bold tracking-widest text-secondary uppercase">
          No matching cities in {country}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low p-4 text-center font-display text-xs font-bold tracking-widest text-secondary uppercase">
            No cities in this country yet
          </p>
          {isPicker && (
            <button
              type="button"
              onClick={onCommitCountryAll}
              className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-[9999px] border border-primary bg-primary p-3 text-left text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-2 active:translate-y-px"
            >
              <span className="font-display text-sm font-bold tracking-wide uppercase">
                View all {country} spots
              </span>
              <ArrowRight
                size={14}
                className="opacity-60 group-hover:opacity-100"
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
