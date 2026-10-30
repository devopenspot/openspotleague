"use client";

import { WeatherIcon } from "@/components/spots/weather/WeatherIcon";
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon";
import type { WeatherIconName } from "@/lib/types";

interface VerifiedWeatherDualIconsProps {
  apiIcon?: string | null;
  leaderIcon: WeatherIconName;
  count: number;
  iconSize?: number;
  iconClassName?: string;
  badgeClassName?: string;
  containerClassName?: string;
}

/**
 * Renders the dual weather icons:
 * 1. The weather suggested by the weather API (when available).
 * 2. The most-voted weather condition verified by the community, with vote count badge.
 */
export function VerifiedWeatherDualIcons({
  apiIcon,
  leaderIcon,
  count,
  iconSize = 14,
  iconClassName = "shrink-0",
  badgeClassName,
  containerClassName = "inline-flex items-center gap-1.5",
}: VerifiedWeatherDualIconsProps) {
  const validApiIcon = isWeatherIconName(apiIcon) ? apiIcon : null;
  const defaultBadgeClass =
    "inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-1 text-center text-[10px] font-bold leading-none tracking-[0.05em] text-on-surface";

  return (
    <span className={containerClassName}>
      {validApiIcon ? (
        <span
          className="inline-flex items-center"
          title={`Forecast: ${validApiIcon}`}
        >
          <WeatherIcon
            name={validApiIcon}
            size={iconSize}
            className={iconClassName}
          />
        </span>
      ) : null}

      {validApiIcon ? (
        <span
          aria-hidden="true"
          className="select-none text-[10px] font-semibold opacity-40"
        >
          /
        </span>
      ) : null}

      <span
        className="relative inline-flex items-center gap-1"
        title={`Community consensus: ${leaderIcon} (${count} vote${count === 1 ? "" : "s"})`}
      >
        <WeatherIcon
          name={leaderIcon}
          size={iconSize}
          className={iconClassName}
        />
        <span className={badgeClassName ?? defaultBadgeClass}>{count}</span>
      </span>
    </span>
  );
}
