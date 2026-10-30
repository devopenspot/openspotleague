"use client";

import { AppImage } from "@/components/ui/AppImage";
import {
  ArrowUpRight,
  Instagram,
  MapPin,
  Navigation,
  Share2,
  ShieldCheck,
  Swords,
  X,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { showToast } from "@/hooks/ui/useToast";
import { shareOrCopyUrl } from "@/lib/utils/share";
import { getOrFetchShortUrl } from "@/lib/utils/short-url";
import { useSpotsStore } from "@/stores/spots-store";
import { useMapStore } from "@/stores/map-store";
import { unionById } from "@/components/map/shared/map-derived";
import { useMapActions } from "@/components/map/hooks/use-map-actions";
import Link from "next/link";
import { SpotMapFallback } from "@/components/spots/card/SpotMapFallback";
import { useEventPopup } from "@/hooks/data/useEventPopup";
import { EventPanel } from "@/components/map/panels/EventPanel";
import type { MapEvent } from "@/types/sport-events";
import type { MapSpot } from "@/lib/types";
import { buildGamePrefillUrl } from "@/lib/games/prefill";
import { useWeatherVerification } from "@/hooks/data/useWeatherVerification";
import { useSpotWeather } from "@/hooks/data/useSpotWeather";
import { VerifiedWeatherDualIcons } from "@/components/spots/weather/VerifiedWeatherDualIcons";
import { SpotWeatherVerificationDialog } from "@/components/spots/verification/SpotWeatherVerificationDialog";
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon";
import { CloudSun } from "lucide-react";

function verificationCountLabel(count: number): string {
  if (count === 0) return "No verifications yet";
  if (count === 1) return "Verified by 1 rider";
  return `Verified by ${count} riders`;
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function MapInfoPopupBase({ events }: { events?: readonly MapEvent[] }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const activePinId = useMapStore((s) => s.activePinId);
  const activeEventId = useMapStore((s) => s.activeEventId);
  const spots = useSpotsStore((s) => s.spots);
  const countrySpots = useSpotsStore((s) => s.countrySpots);
  const citySpots = useSpotsStore((s) => s.citySpots);
  const nearbySpots = useSpotsStore((s) => s.nearbySpots);

  const { clearActivePin } = useMapActions();
  const event = useEventPopup(activeEventId, events);

  // The pin can point at a country-, city-, or nearby-scoped spot
  // (outside the capped base directory), so resolve against the union
  // of all slices.
  const resolvable = useMemo(
    () =>
      [spots, citySpots, countrySpots, nearbySpots].reduce(
        unionById,
        [] as readonly MapSpot[],
      ),
    [citySpots, countrySpots, nearbySpots, spots],
  );
  const spot = useMemo(
    () =>
      activePinId
        ? (resolvable.find((s) => s.id === activePinId) ?? null)
        : null,
    [activePinId, resolvable],
  );
  const gamePrefillHref = useMemo(
    () =>
      spot
        ? buildGamePrefillUrl(spot, { spotType: spot.types[0]?.slug ?? null })
        : "/games",
    [spot],
  );
  const { summary: weatherSummary } = useWeatherVerification(spot?.id ?? null);
  const { weather: forecastWeather } = useSpotWeather(
    weatherSummary?.active && spot ? spot.id : null,
  );
  const [verifyOpen, setVerifyOpen] = useState(false);

  // Event popup takes precedence over spot popup when both are
  // briefly set (race during cross-fade). The store keeps them
  // mutually exclusive on set/toggle, but this guards against any
  // external clearActivePins() that happens to leave a stale id.
  const showEvent = event !== null;
  const isVisible = spot !== null || showEvent;

  useEffect(() => {
    if (!isVisible || verifyOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      // Overlay is portaled to document.body, so its backdrop/clicks are outside panelRef.
      // Don't close the map popup when the verification dialog is open or its backdrop is clicked.
      const verificationDialog = document.getElementById(
        "weather-verify-dialog",
      );
      if (verificationDialog?.contains(target)) return;
      clearActivePin();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isVisible, verifyOpen, clearActivePin]);

  useEffect(() => {
    if (!isVisible) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? panelRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [isVisible, panelRef]);

  const shortcuts = useMemo(
    () =>
      isVisible && !verifyOpen
        ? [{ key: "Escape", handler: clearActivePin }]
        : [],
    [isVisible, verifyOpen, clearActivePin],
  );
  useKeyboardShortcuts(shortcuts);

  const handleShare = useCallback(async () => {
    if (!spot) return;
    const url = await getOrFetchShortUrl(`/spots/${spot.id}`, spot.name);
    const result = await shareOrCopyUrl(url, spot.name);
    if (result === "shared") showToast("Share sheet opened.", "success");
    else if (result === "copied") showToast("Link copied.", "success");
    else showToast("Could not share this link.", "error");
  }, [spot]);

  if (showEvent && event) {
    return (
      <EventPanel
        event={event}
        onClose={clearActivePin}
        titleId={titleId}
        panelRef={panelRef}
      />
    );
  }

  if (!spot) return null;

  const wazeUrl = `https://waze.com/ul?ll=${spot.location.lat},${spot.location.lon}&navigate=yes`;
  const hasInstagram = !!spot.instagram && isSafeExternalUrl(spot.instagram);
  const verificationLabel = verificationCountLabel(spot.verificationCount);
  const shortVerification =
    spot.verificationCount === 0
      ? "No verifications"
      : spot.verificationCount === 1
        ? "1 verified"
        : `${spot.verificationCount} verified`;

  return (
    <>
      <div
        ref={panelRef}
        id="map-info-popup"
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed bottom-4 left-0 right-0 z-[1150] mx-auto flex max-h-[min(46dvh,360px)] w-auto flex-col overflow-hidden rounded-t-[16px] border border-outline-variant bg-surface-bright pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] outline-none animate-slide-up md:absolute md:bottom-5 md:left-auto md:right-3 md:mx-0 md:max-h-[min(72vh,520px)] md:w-96 md:rounded-[16px] md:pb-0 md:shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
      >
        {/* --- Image header: capped height so mobile map stays visible --- */}
        <div
          className={`group relative h-[100px] w-full shrink-0 overflow-hidden text-surface min-[380px]:h-[164px] md:h-[220px] ${
            spot.image ? "bg-on-surface" : "map-theme-lighter bg-map-surface"
          }`}
        >
          <div className="absolute inset-0">
            {spot.image ? (
              <AppImage
                src={spot.image}
                alt={spot.name}
                fill
                sizes="(min-width: 768px) 384px, 100vw"
                className="object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            ) : (
              <SpotMapFallback
                lat={spot.location.lat}
                lon={spot.location.lon}
                title={spot.name}
              />
            )}
          </div>

          {/* Gradients for readability over any photo — lighter over map fallback so +10% map theme stays bright */}
          <div
            className={`absolute inset-0 pointer-events-none ${
              spot.image
                ? "bg-gradient-to-t from-on-surface/85 via-on-surface/30 to-on-surface/10"
                : "bg-gradient-to-t from-map-surface/75 via-map-surface/15 to-transparent"
            }`}
            aria-hidden="true"
          />
          <div
            className={`absolute inset-0 pointer-events-none ${
              spot.image
                ? "bg-gradient-to-b from-on-surface/25 via-transparent to-transparent md:from-on-surface/20"
                : "bg-gradient-to-b from-map-surface/15 via-transparent to-transparent"
            }`}
            aria-hidden="true"
          />

          {/* Drag handle — mobile affordance, no layout height cost */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-surface/60 backdrop-blur-sm md:hidden"
          />

          {/* Top bar: badges + close */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-5 md:p-3.5 md:pt-3.5">
            <div className="min-w-0 flex-1 pt-0.5"></div>

            <button
              type="button"
              onClick={clearActivePin}
              aria-label="Close spot details"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-surface/25 bg-on-surface/40 text-surface backdrop-blur-md transition-colors hover:bg-on-surface/60 hover:text-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:h-9 md:w-9"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          {/* Weather verification — allows any user to verify weather, displays dual tiny icons (API suggested + community leader) */}
          {weatherSummary?.active &&
          weatherSummary.leader &&
          isWeatherIconName(weatherSummary.leader) ? (
            <button
              type="button"
              onClick={() => setVerifyOpen(true)}
              aria-label="Confirm on-site weather condition"
              title="Confirm on-site weather (requires GPS proximity within 250m)"
              className="absolute left-3 top-14 flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 md:left-3.5 md:top-12"
            >
              <VerifiedWeatherDualIcons
                apiIcon={forecastWeather?.icon}
                leaderIcon={weatherSummary.leader}
                count={weatherSummary.count}
                iconSize={14}
                iconClassName="shrink-0 text-on-primary"
                badgeClassName="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-1 text-center text-[10px] font-bold leading-none tracking-[0.05em] text-on-surface"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVerifyOpen(true)}
              aria-label="Confirm on-site weather condition"
              title="Confirm on-site weather (requires GPS proximity within 250m)"
              className="absolute right-12 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-surface/30 bg-on-surface/40 text-surface backdrop-blur-md hover:bg-on-surface/60 md:left-3.5 md:top-12"
            >
              <CloudSun size={14} aria-hidden="true" />
            </button>
          )}

          {/* Bottom overlay: title + meta — guaranteed contrast via gradient above */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 md:p-3.5">
            <h4
              id={titleId}
              className="line-clamp-2 max-w-[92%] text-pretty font-display text-[18px] font-bold uppercase leading-[0.95] tracking-tight text-surface [text-shadow:0_1px_16px_rgba(0,0,0,0.55)] md:max-w-[90%] md:text-[20px]"
              title={spot.name}
            >
              {spot.name}
            </h4>

            {/* Meta row: city + verification + instagram — compact pills that stay readable on photo */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-surface/20 bg-on-surface/40 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-surface backdrop-blur-sm">
                <MapPin size={10} aria-hidden="true" className="shrink-0" />
                <span className="max-w-[18ch] truncate">{spot.city}</span>
              </span>

              <span
                aria-label={verificationLabel}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-on-surface/40 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-surface backdrop-blur-sm"
                title={verificationLabel}
              >
                <ShieldCheck
                  size={10}
                  aria-hidden="true"
                  className="shrink-0"
                />
                <span>{shortVerification}</span>
              </span>

              {hasInstagram ? (
                <a
                  href={spot.instagram!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${spot.name} on Instagram (opens in a new tab)`}
                  className="inline-flex items-center gap-1 rounded-full border border-surface/20 bg-on-surface/40 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-surface backdrop-blur-sm transition-colors hover:bg-on-surface/60 hover:text-surface focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                >
                  <Instagram
                    size={10}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <span>Instagram</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* --- Action bar: outside the image so header height stays capped (4 pills, one row) --- */}
        <div className="flex shrink-0 items-center gap-1.5 bg-surface-bright px-2.5 py-2.5 md:gap-2 md:px-3.5 md:py-3">
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label={`Share ${spot.name}`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-outline-variant bg-surface px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-3 md:text-[11px]"
          >
            <Share2 size={12} aria-hidden="true" className="shrink-0" />
            <span>Share</span>
          </button>

          <Link
            href={`/spots/${spot.id}`}
            aria-label={`Open ${spot.name} details`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-outline-variant bg-surface px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-3 md:text-[11px]"
          >
            <span>Details</span>
            <ArrowUpRight size={12} aria-hidden="true" className="shrink-0" />
          </Link>

          <Link
            href={gamePrefillHref}
            onClick={() => clearActivePin()}
            aria-label={`Train or challenge at ${spot.name}`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-primary bg-primary px-2 text-[10px] font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-3 md:text-[11px]"
          >
            <Swords size={12} aria-hidden="true" className="shrink-0" />
            <span className="hidden sm:inline">Train</span>
            <span className="sm:hidden">Train</span>
          </Link>

          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open directions to ${spot.name} in Waze (opens in a new tab)`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-outline-variant bg-surface px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 md:px-3 md:text-[11px]"
          >
            <Navigation size={12} aria-hidden="true" className="shrink-0" />
            <span>Waze</span>
          </a>
        </div>
      </div>
      {spot ? (
        <SpotWeatherVerificationDialog
          isOpen={verifyOpen}
          onClose={() => setVerifyOpen(false)}
          spot={spot}
        />
      ) : null}
    </>
  );
}

export const MapInfoPopup = memo(MapInfoPopupBase);
