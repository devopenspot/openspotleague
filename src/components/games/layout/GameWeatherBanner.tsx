"use client"

import { WeatherIcon } from "@/components/spots/weather/WeatherIcon"
import { formatTemp } from "@/lib/weather/format"
import { useTemperatureUnit } from "@/hooks/preferences/useTemperatureUnit"
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon"
import type { GameState } from "@/lib/schemas/game"

type Props = {
  game: Pick<
    GameState,
    | "spotId"
    | "weatherForecastIcon"
    | "weatherObservedIcon"
    | "weatherConfirmed"
    | "weatherForecastDescription"
    | "weatherForecastTemp"
    | "weatherReportedAt"
  >
  variant?: "expanded" | "compact"
  spotName?: string | null
  className?: string
}

export function GameWeatherBanner({ game, variant = "expanded", spotName, className }: Props) {
  const temperatureUnit = useTemperatureUnit()
  if (!game.spotId || !game.weatherForecastIcon) return null
  const forecastIcon = isWeatherIconName(game.weatherForecastIcon) ? game.weatherForecastIcon : "sunny"
  const observedIcon = isWeatherIconName(game.weatherObservedIcon) ? game.weatherObservedIcon : forecastIcon
  const confirmed = game.weatherConfirmed ?? true
  const temp = game.weatherForecastTemp ?? null
  const description = game.weatherForecastDescription ?? forecastIcon
  const reportedAt = game.weatherReportedAt ? new Date(game.weatherReportedAt) : null
  const reportedLabel = reportedAt
    ? reportedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null

  if (variant === "compact") {
    return (
      <span
        data-testid="game-weather-pill"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${confirmed ? "border-primary/30 bg-primary/10 text-primary" : "border-permission-pending/30 bg-permission-pending/10 text-permission-pending"} ${className ?? ""}`}
        title={confirmed ? `Verified live: ${observedIcon}` : `Rider-corrected: ${observedIcon} (forecast ${forecastIcon})`}
      >
        <WeatherIcon name={observedIcon} size={14} aria-hidden="true" />
        <span className="capitalize">{observedIcon.replaceAll("_", " ")}</span>
        {temp !== null ? <span className="font-display">{formatTemp(temp, temperatureUnit)}</span> : null}
        <span className={`h-1.5 w-1.5 rounded-full ${confirmed ? "bg-primary" : "bg-permission-pending"}`} aria-hidden="true" />
        <span className="sr-only">{confirmed ? "Verified live" : "Rider corrected"}</span>
      </span>
    )
  }

  return (
    <section
      aria-labelledby="game-weather-title"
      data-testid="game-weather-banner"
      className={`rounded-[16px] border bg-surface-container-lowest p-4 ${confirmed ? "border-primary/30" : "border-permission-pending/30"} ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id="game-weather-title" className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
            {spotName ? `Spot weather · ${spotName}` : "Spot weather"}
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-display text-[10px] font-semibold uppercase tracking-wider">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${confirmed ? "bg-primary text-on-primary" : "bg-permission-pending text-surface"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-surface" aria-hidden="true" />
              {confirmed ? "Verified live" : "Rider-corrected"}
            </span>
            {reportedLabel ? <span className="text-secondary">{reportedLabel}</span> : null}
          </p>
        </div>
        <WeatherIcon name={observedIcon} size={32} className="shrink-0" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="font-display text-2xl font-bold leading-none">{temp !== null ? formatTemp(temp, temperatureUnit) : "—"}</span>
        <span className="text-xs leading-5 text-on-surface-variant">{description}</span>
      </div>

      {!confirmed ? (
        <p className="mt-2 rounded-[16px] border border-permission-pending/20 bg-permission-pending/10 px-3 py-2 font-display text-[10px] uppercase tracking-wider text-permission-pending">
          Forecast was <span className="font-bold">{forecastIcon.replaceAll("_", " ")}</span> · observed <span className="font-bold">{observedIcon.replaceAll("_", " ")}</span>
        </p>
      ) : (
        <p className="mt-2 font-display text-[10px] uppercase tracking-wider text-secondary">Forecast confirmed on site</p>
      )}
    </section>
  )
}

export function GameWeatherPill(props: Props) {
  return <GameWeatherBanner {...props} variant="compact" />
}
