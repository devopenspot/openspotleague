"use client";

import { CloudOff, Radio } from "lucide-react";
import { WeatherIcon } from "@/components/spots/weather/WeatherIcon";
import { WeatherAccuracyNote } from "@/components/spots/weather/WeatherAccuracyNote";
import { VerifiedWeatherDualIcons } from "@/components/spots/weather/VerifiedWeatherDualIcons";
import { formatTemp } from "@/lib/weather/format";
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon";
import type { TemperatureUnit } from "@/stores/preferences-store";
import type { Spot } from "@/lib/types";
import type { WeatherVerificationSummary } from "@/lib/repositories/spot/weather-verification-repository";

interface SpotDetailsWeatherProps {
  spot: Spot;
  weather: {
    icon?: string | null;
    current?: number | null;
    description?: string | null;
    wind?: number | null;
    humidity?: number | null;
  } | null | undefined;
  temperatureUnit: TemperatureUnit;
  weatherSummary?: WeatherVerificationSummary | null;
}

export function SpotDetailsWeather({
  spot,
  weather,
  temperatureUnit,
  weatherSummary,
}: SpotDetailsWeatherProps) {
  const windKmh = weather?.wind != null ? Math.round(weather.wind * 3.6) : null;
  const isVerifiedActive = Boolean(
    weatherSummary?.active &&
      weatherSummary.leader &&
      isWeatherIconName(weatherSummary.leader),
  );

  return (
    <section
      aria-labelledby="weather-status-heading"
      className="bg-surface-container-low px-5 py-4 md:px-8 md:py-6 space-y-4 -mx-5 md:-mx-8 border-y border-outline-variant/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="weather-status-heading"
            className="font-display text-[10px] font-bold uppercase tracking-wider text-secondary"
          >
            Weather status
            <WeatherAccuracyNote variant="block" />
          </h2>
          {isVerifiedActive && weatherSummary?.leader && isWeatherIconName(weatherSummary.leader) ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-2.5 py-1 text-[11px] font-semibold text-on-surface"
              data-testid="weather-status-community-badge"
            >
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
                Verified
              </span>
              <VerifiedWeatherDualIcons
                apiIcon={weather?.icon}
                leaderIcon={weatherSummary.leader}
                count={weatherSummary.count}
                iconSize={14}
              />
            </span>
          ) : null}
        </div>
        <a
          href={`https://zoom.earth/maps/precipitation/#view=${spot.location.lat},${spot.location.lon},10z/model=icon`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View live precipitation on zoom.earth (opens in a new tab)"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 font-display text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
        >
          <span>Live weather</span>
          <Radio size={11} aria-hidden="true" />
        </a>
      </div>

      <div className="flex min-w-0 flex-nowrap items-center gap-3 sm:gap-4">
        {weather?.icon && isWeatherIconName(weather.icon) ? (
          <WeatherIcon name={weather.icon} size={64} className="shrink-0" />
        ) : (
          <CloudOff size={56} aria-hidden="true" className="shrink-0 text-secondary" />
        )}
        <div className="flex min-w-[6rem] flex-col justify-center">
          <span className="block whitespace-nowrap font-display text-3xl font-bold leading-none tracking-tight text-on-surface">
            {formatTemp(weather?.current ?? null, temperatureUnit)}
          </span>
          <span className="mt-1 block max-w-[140px] truncate font-display text-xs font-medium text-secondary capitalize">
            {weather?.description ?? "Weather unavailable"}
          </span>
        </div>
        <dl className="ml-auto flex shrink-0 items-center gap-3 divide-x divide-outline-variant/60 text-right">
          <div className="flex flex-col items-end gap-0.5 pl-3 first:pl-0">
            <dt className="whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
              Wind
            </dt>
            <dd className="whitespace-nowrap font-display text-xs font-semibold text-on-surface">
              {windKmh !== null ? `${windKmh} km/h` : "—"}
            </dd>
          </div>
          <div className="flex flex-col items-end gap-0.5 pl-3">
            <dt className="whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
              Humidity
            </dt>
            <dd className="whitespace-nowrap font-display text-xs font-semibold text-on-surface">
              {weather?.humidity != null ? `${weather.humidity}%` : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
