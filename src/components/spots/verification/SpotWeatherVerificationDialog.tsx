"use client"

import { useState } from "react"
import { CloudSun, X } from "lucide-react"
import Link from "next/link"
import { Overlay } from "@/components/feedback/Overlay"
import { useUser } from "@/lib/contexts/user-context"
import { useUserLocation } from "@/hooks/map/useUserLocation"
import { useSpotWeather } from "@/hooks/data/useSpotWeather"
import { useWeatherVerification } from "@/hooks/data/useWeatherVerification"
import { useTemperatureUnit } from "@/hooks/preferences/useTemperatureUnit"
import { haversineMeters } from "@/lib/spots/geo"
import { showToast } from "@/hooks/ui/useToast"
import { WeatherConfirmSection } from "@/components/games/create/form-parts"
import type { MapSpot, WeatherIconName } from "@/lib/types"

interface SpotWeatherVerificationDialogProps {
  isOpen: boolean
  onClose: () => void
  spot: MapSpot
  containerClassName?: string
}

export function SpotWeatherVerificationDialog({ isOpen, onClose, spot, containerClassName }: SpotWeatherVerificationDialogProps) {
  const user = useUser()
  const signedIn = Boolean(user)
  const { location, request } = useUserLocation()
  const temperatureUnit = useTemperatureUnit()
  const { weather: forecastWeather } = useSpotWeather(isOpen ? spot.id : null)
  const { verifying, verify } = useWeatherVerification(spot.id)
  const [weatherConfirmed, setWeatherConfirmed] = useState<boolean | null>(null)
  const [weatherObservedIcon, setWeatherObservedIcon] = useState<WeatherIconName | null>(null)

  const canVerify =
    signedIn && forecastWeather && weatherConfirmed !== null && (weatherConfirmed === true || weatherObservedIcon !== null) && !verifying

  const handleVerify = async () => {
    const voteIcon: WeatherIconName | null =
      weatherConfirmed === true ? (forecastWeather?.icon as WeatherIconName) : weatherObservedIcon
    if (!voteIcon) return

    let loc = location
    if (!loc) {
      const status = await request()
      loc = location
      // refetch after request — use store directly to avoid stale closure
      const { useUserLocationStore } = await import("@/stores/user-location-store")
      const fresh = useUserLocationStore.getState().location
      if (fresh) loc = fresh
      if (!loc || status !== "granted") {
        showToast("Share location to verify weather", "error")
        return
      }
    }

    const distance = Math.round(haversineMeters(loc.lat, loc.lon, spot.location.lat, spot.location.lon))
    if (distance > 250) {
      showToast(`Move closer — you're ${distance} m away`, "error")
      return
    }
    if (loc.accuracy != null && loc.accuracy > 50) {
      showToast("Move to clearer sky — accuracy too low", "error")
      return
    }

    try {
      await verify({ latitude: loc.lat, longitude: loc.lon, accuracyMeters: loc.accuracy ?? null, voteIcon })
      setWeatherConfirmed(null)
      setWeatherObservedIcon(null)
      onClose()
    } catch {
      // toast in hook
    }
  }

  const handleClose = () => {
    if (verifying) return
    onClose()
  }

  return (
    <Overlay
      isOpen={isOpen}
      onClose={handleClose}
      labelledBy="weather-verify-title"
      describedBy="weather-verify-description"
      contentId="weather-verify-dialog"
      containerClassName={containerClassName}
      panelClassName="mx-4 my-6 flex max-h-[min(90dvh,720px)] w-full max-w-[36rem] flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface-bright"
    >
      <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="weather-verify-title" className="font-display text-sm font-bold uppercase tracking-tight flex items-center gap-1.5">
            <CloudSun size={16} aria-hidden="true" className="text-primary" />
            Verify weather
          </h2>
          <p className="mt-1 truncate font-display text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{spot.name}</p>
          <p id="weather-verify-description" className="sr-only">Confirm current weather for this spot</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close verification dialog"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-4 no-scrollbar">
        {!signedIn ? (
          <p className="rounded-md border border-outline-variant bg-surface-container px-3 py-3 text-sm">
            <Link href={`/login?next=/spots/${spot.id}`} className="font-bold underline">Sign in</Link> to verify weather.
          </p>
        ) : (
          <WeatherConfirmSection
            idPrefix={`verify-dialog-${spot.id}`}
            forecastWeather={forecastWeather}
            weatherConfirmed={weatherConfirmed}
            weatherObservedIcon={weatherObservedIcon}
            onConfirm={setWeatherConfirmed}
            onObservedChange={setWeatherObservedIcon}
            temperatureUnit={temperatureUnit}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-5 py-4 sm:px-6">
        <button type="button" onClick={handleClose} disabled={verifying} className="min-h-11 rounded-full border border-outline-variant bg-surface px-4 font-display text-xs font-bold uppercase tracking-[0.05em] disabled:opacity-50">
          Cancel
        </button>
        {signedIn ? (
          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={!canVerify}
            className="min-h-11 rounded-full border border-primary bg-primary px-5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Verify"}
          </button>
        ) : null}
      </div>
    </Overlay>
  )
}
