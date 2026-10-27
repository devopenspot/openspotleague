"use client";

import dynamic from "next/dynamic";
import { AppImage } from "@/components/ui/AppImage";
import {
  Loader2,
  MapPin,
  Radar,
  ShieldCheck,
  Instagram,
  CheckCheck,
} from "lucide-react";
import { TypeBadges } from "@/components/spots/shared/TypeBadges";
import {
  verificationCountLabel,
  isSafeExternalUrl,
} from "./spot-detail.helpers";
import { VerifiedWeatherDualIcons } from "@/components/spots/weather/VerifiedWeatherDualIcons";
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon";
import type { Spot } from "@/lib/types";
import type { WeatherVerificationSummary } from "@/lib/repositories/spot/weather-verification-repository";

interface SpotDetailsHeroProps {
  spot: Spot;
  distanceInfo:
    | { kind: "distance"; label: string }
    | { kind: string; label: string };
  isRequestingLocation: boolean;
  onRequestLocation: () => void;
  weatherSummary?: WeatherVerificationSummary | null;
  weatherIcon?: string | null;
  onVerifyClick?: () => void;
}

const SpotStaticMap = dynamic(
  () => import("./SpotStaticMap").then((m) => m.SpotStaticMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-map-surface " />,
  },
);

export function SpotDetailsHero({
  spot,
  distanceInfo,
  isRequestingLocation,
  onRequestLocation,
  weatherSummary,
  weatherIcon,
  onVerifyClick,
}: SpotDetailsHeroProps) {
  const hasImage = Boolean(spot.image?.trim());
  return (
    <div className="group relative h-[22rem] w-full overflow-hidden bg-on-surface md:h-auto md:min-h-[38rem] md:max-h-[640px] md:w-[55%]">
      {hasImage ? (
        <AppImage
          src={spot.image}
          alt={spot.name}
          fill
          sizes="(min-width: 768px) 55vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          referrerPolicy="no-referrer"
          unoptimized
          priority
        />
      ) : (
        <SpotStaticMap location={spot.location} name={spot.name} />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-on-surface/10 to-transparent pointer-events-none"
        aria-hidden="true"
      />
      {/* Weather verification — allows any user to verify weather, displays dual tiny icons (API suggested + community leader) */}
      {weatherSummary?.active &&
      weatherSummary.leader &&
      isWeatherIconName(weatherSummary.leader) ? (
        onVerifyClick ? (
          <button
            type="button"
            onClick={onVerifyClick}
            aria-label={`Verify weather — forecast ${weatherIcon ?? "unknown"}, community ${weatherSummary.leader} (${weatherSummary.count} votes)`}
            title="Confirm on-site weather condition"
            className="absolute left-4 top-4 flex min-h-11 items-center gap-2 rounded-full border border-surface/50 bg-on-surface/60 px-3 text-surface backdrop-blur-sm transition-colors hover:bg-on-surface/80 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 md:left-6 md:top-6"
          >
            <VerifiedWeatherDualIcons
              apiIcon={weatherIcon}
              leaderIcon={weatherSummary.leader}
              count={weatherSummary.count}
              iconSize={14}
              iconClassName="shrink-0 text-surface"
              badgeClassName="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-1.5 text-center text-[10px] font-bold leading-none tracking-[0.05em] text-on-surface"
            />
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-surface">
              Weather verified
            </span>
          </button>
        ) : (
          <div className="absolute left-4 top-4 flex min-h-11 items-center gap-2 rounded-full border border-surface/50 bg-on-surface/60 px-3 text-surface backdrop-blur-sm md:left-6 md:top-6">
            <VerifiedWeatherDualIcons
              apiIcon={weatherIcon}
              leaderIcon={weatherSummary.leader}
              count={weatherSummary.count}
              iconSize={14}
              iconClassName="shrink-0 text-surface"
              badgeClassName="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-1.5 text-center text-[10px] font-bold leading-none tracking-[0.05em] text-on-surface"
            />
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-surface">
              Weather verified
            </span>
          </div>
        )
      ) : onVerifyClick ? (
        <button
          type="button"
          onClick={onVerifyClick}
          aria-label="Verify weather"
          className="absolute left-4 top-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-surface/50 bg-on-surface/40 px-3 font-display text-xs font-semibold uppercase tracking-wider text-surface backdrop-blur-sm transition-colors hover:bg-on-surface/60 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 md:left-6 md:top-6"
        >
          <CheckCheck size={14} aria-hidden="true" className="shrink-0" />
          <span>Verify Weather</span>
        </button>
      ) : null}

      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        {distanceInfo.kind === "distance" ? (
          <span className="inline-flex min-h-11 items-center rounded-full border border-surface/50 bg-on-surface/40 px-3 font-display text-xs font-semibold tracking-wider text-surface uppercase backdrop-blur-sm">
            {distanceInfo.label}
          </span>
        ) : (
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={isRequestingLocation}
            aria-busy={isRequestingLocation}
            aria-label="Share your location to see distance from this spot"
            className="group inline-flex min-h-11 items-center gap-1.5 rounded-full border border-surface/50 bg-on-surface/40 px-3 font-display text-xs font-semibold tracking-wider text-surface uppercase backdrop-blur-sm transition-colors hover:bg-on-surface/60 hover:underline disabled:cursor-wait disabled:opacity-60 disabled:no-underline"
          >
            {isRequestingLocation ? (
              <Loader2 size={12} aria-hidden="true" className="animate-spin" />
            ) : (
              <Radar
                size={12}
                aria-hidden="true"
                className="animate-radar-sweep transition-transform group-hover:scale-110"
              />
            )}
            <span>
              {isRequestingLocation ? "Locating…" : distanceInfo.label}
            </span>
          </button>
        )}
      </div>

      <div className="absolute bottom-4 left-4 right-4 text-surface md:bottom-6 md:left-6 md:right-6">
        {spot.types.length > 0 ? (
          <div className="mb-2">
            <TypeBadges types={spot.types} variant="overlay" />
          </div>
        ) : null}
        {(spot.types.length > 0 || spot.sports.length > 0) && (
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {spot.sports.length > 0 && (
              <div className="flex items-center gap-2">
                <dd className="font-display text-[10px] font-bold uppercase tracking-widest text-surface/75">
                  {spot.sports.join(", ")}
                </dd>
              </div>
            )}
          </dl>
        )}
        <h1 className="mt-4 border-t border-surface/30 pt-4 font-display text-3xl font-bold uppercase leading-tight tracking-tight sm:text-4xl">
          {spot.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="flex items-center text-xs text-surface/80">
            <MapPin size={12} className="mr-1 shrink-0" aria-hidden="true" />
            {`${spot.city} · ${spot.country}`}
          </p>
          {spot.instagram && isSafeExternalUrl(spot.instagram) && (
            <a
              href={spot.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${spot.name} on Instagram (opens in a new tab)`}
              className="inline-flex items-center text-xs text-surface/80 transition-colors hover:text-surface"
            >
              <Instagram
                size={12}
                className="mr-1 shrink-0"
                aria-hidden="true"
              />
              Instagram
            </a>
          )}
        </div>
        <p
          className="mt-2 flex items-center font-display text-[10px] font-bold uppercase tracking-widest text-surface/75"
          aria-label={verificationCountLabel(spot.verificationCount)}
        >
          <ShieldCheck size={11} className="mr-1 shrink-0" aria-hidden="true" />
          {verificationCountLabel(spot.verificationCount)}
        </p>
      </div>
    </div>
  );
}
