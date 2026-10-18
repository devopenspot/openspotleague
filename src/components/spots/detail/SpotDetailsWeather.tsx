"use client";

import { CloudOff, Radio } from "lucide-react";
import { WeatherIcon } from "@/components/spots/weather/WeatherIcon";
import { WeatherAccuracyNote } from "@/components/spots/weather/WeatherAccuracyNote";
import { formatTemp } from "@/lib/weather/format";
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon";
import type { TemperatureUnit } from "@/stores/preferences-store";
import type { Spot } from "@/lib/types";

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
}

export function SpotDetailsWeather({
  spot,
  weather,
  temperatureUnit,
}: SpotDetailsWeatherProps) {
  const windKmh = weather?.wind != null ? Math.round(weather.wind * 3.6) : null;
  return (
    <section
      aria-labelledby="weather-status-heading"
      className="bg-surface-container-low p-4 md:p-6 space-y-4 -mx-6 md:-mx-8 border-y border-outline-variant/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 ml-2">
        <h2
          id="weather-status-heading"
          className="font-display text-[10px] font-bold uppercase tracking-wider text-secondary"
        >
          Weather status
          <WeatherAccuracyNote variant="block" />
        </h2>
        <a
          href={`https://zoom.earth/maps/precipitation/#view=${spot.location.lat},${spot.location.lon},10z/model=icon`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View live precipitation on zoom.earth (opens in a new tab)"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline px-3 font-display text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container"
        >
          <span>Live weather</span>
          <Radio size={11} aria-hidden="true" className="animate-radar-pulse" />
        </a>
      </div>

      <div className="flex min-w-0 flex-nowrap items-center md:gap-4 md:ml-3">
        {weather?.icon && isWeatherIconName(weather.icon) ? (
          <WeatherIcon name={weather.icon} size={120} className="shrink-0" />
        ) : (
          <CloudOff size={100} aria-hidden="true" className="shrink-0 text-secondary" />
        )}
        <div className="flex min-w-[7rem] flex-1 flex-col items-center justify-center text-center">
          <span className="block whitespace-nowrap font-display text-2xl font-bold leading-none tracking-tight">
            {formatTemp(weather?.current ?? null, temperatureUnit)}
          </span>
          <span className="mt-1 block w-full truncate font-display text-[10px] text-secondary">
            {weather?.description ?? "Weather unavailable"}
          </span>
        </div>
        <dl className="flex w-full min-w-0 flex-row gap-2 divide-x divide-outline-variant/60 overflow-hidden text-center md:ml-auto md:w-auto">
          <div className="flex min-w-0 basis-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 first:pl-0 last:pr-0">
            <dt className="whitespace-nowrap font-display text-[10px] uppercase tracking-wider text-secondary">
              Wind
            </dt>
            <dd className="w-full truncate font-display text-xs font-semibold text-on-surface">
              {windKmh !== null ? `${windKmh} km/h` : "—"}
            </dd>
          </div>
          <div className="flex min-w-0 basis-0 flex-1 flex-col items-center justify-center gap-0.5 px-2">
            <dt className="whitespace-nowrap font-display text-[10px] uppercase tracking-wider text-secondary">
              Humidity
            </dt>
            <dd className="w-full truncate font-display text-xs font-semibold text-on-surface">
              {weather?.humidity != null ? `${weather.humidity}%` : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
