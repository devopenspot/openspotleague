"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpotWeather } from "@/hooks/data/useSpotWeather";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";
import { useTemperatureUnit } from "@/hooks/preferences/useTemperatureUnit";
import { useSpotsStore } from "@/stores/spots-store";
import { getSpotDistanceInfo } from "@/lib/spots/geo";
import { buildBackToMapUrl } from "@/lib/spots/back-to-map";
import { buildGamePrefillUrl } from "@/lib/games/prefill";
import { showToast } from "@/hooks/ui/useToast";
import { SpotDetailsHero } from "./SpotDetailsHero";
import { SpotDetailsActions } from "./SpotDetailsActions";
import { SpotDetailsWeather } from "./SpotDetailsWeather";
import { SpotDetailsLocation } from "./SpotDetailsLocation";
import { SpotWeatherVerificationDialog } from "@/components/spots/verification/SpotWeatherVerificationDialog";
import { useWeatherVerification } from "@/hooks/data/useWeatherVerification";
import type { Spot } from "@/lib/types";

interface SpotDetailsContentProps {
  spot: Spot;
  isSaved: boolean;
  isVerified: boolean;
  onToggleSave: (id: string, meta?: { name?: string }) => void;
  onToggleVerify: (id: string, meta?: { name?: string }) => void;
}

export function SpotDetailsContent({
  spot,
  isSaved,
  isVerified,
  onToggleSave,
  onToggleVerify,
}: SpotDetailsContentProps) {
  const { weather } = useSpotWeather(spot.id);
  const regions = useSpotsStore((s) => s.regions);
  const { status: locationStatus, location, request } = useUserLocation();
  const distanceUnit = useDistanceUnit();
  const temperatureUnit = useTemperatureUnit();
  const [burstKey, setBurstKey] = useState(0);
  const wasSaved = useRef(isSaved);
  useEffect(() => {
    if (!wasSaved.current && isSaved) setBurstKey((k) => k + 1);
    wasSaved.current = isSaved;
  }, [isSaved]);

  const distanceInfo = getSpotDistanceInfo(
    spot,
    location ? { lat: location.lat, lon: location.lon } : null,
    distanceUnit,
  );
  const isRequestingLocation = locationStatus === "requesting";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + " " + spot.address)}`;
  const wazeUrl = `https://waze.com/ul?ll=${spot.location.lat},${spot.location.lon}&navigate=yes`;
  const viewOnMapUrl = useMemo(
    () => buildBackToMapUrl(spot, regions.length ? regions : undefined),
    [spot, regions],
  );
  const gamePrefillHref = useMemo(
    () => buildGamePrefillUrl(spot, { spotType: spot.types[0]?.slug ?? null }),
    [spot],
  );
  const { summary: weatherSummary } = useWeatherVerification(spot.id);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const handleRequestLocation = useCallback(async () => {
    if (isRequestingLocation) return;
    const next = await request();
    if (next === "denied") {
      showToast(
        "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.",
        "error",
      );
    } else if (next === "unavailable") {
      showToast("Geolocation unavailable in this browser — distance unavailable.", "error");
    } else if (next === "granted") {
      showToast("Distance ready.", "success");
    }
  }, [isRequestingLocation, request]);

  return (
    <div className="flex w-full flex-col overflow-hidden border-y border-outline-variant bg-surface-bright md:flex-row md:rounded-lg md:border">
      <SpotDetailsHero
        spot={spot}
        distanceInfo={distanceInfo}
        isRequestingLocation={isRequestingLocation}
        onRequestLocation={handleRequestLocation}
        weatherSummary={weatherSummary}
        weatherIcon={weather?.icon}
        onVerifyClick={() => setVerifyOpen(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-surface px-5 py-6 no-scrollbar md:px-8 md:py-8">
        <div className="flex flex-1 flex-col">
          <SpotDetailsActions
            spot={spot}
            isSaved={isSaved}
            isVerified={isVerified}
            onToggleSave={onToggleSave}
            onToggleVerify={onToggleVerify}
            burstKey={burstKey}
            locationStatus={locationStatus}
            onRequestLocation={handleRequestLocation}
          />
          <SpotDetailsWeather
            spot={spot}
            weather={weather}
            temperatureUnit={temperatureUnit}
            weatherSummary={weatherSummary}
          />
        </div>
        <SpotDetailsLocation
          spot={spot}
          gamePrefillHref={gamePrefillHref}
          viewOnMapUrl={viewOnMapUrl}
          directionsUrl={directionsUrl}
          wazeUrl={wazeUrl}
        />
      </div>
      <SpotWeatherVerificationDialog isOpen={verifyOpen} onClose={() => setVerifyOpen(false)} spot={spot} />
    </div>
  );
}
