"use client";

import { AppImage } from "@/components/ui/AppImage";
import {
  ArrowUpRight,
  Instagram,
  MapPin,
  Navigation,
  Route,
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
import type { MapEvent } from "@/types/league";
import type { MapSpot } from "@/lib/types";
import { buildGamePrefillUrl } from "@/lib/games/prefill";
import { useWeatherVerification } from "@/hooks/data/useWeatherVerification";
import { useSpotWeather } from "@/hooks/data/useSpotWeather";
import { VerifiedWeatherDualIcons } from "@/components/spots/weather/VerifiedWeatherDualIcons";
import { SpotWeatherVerificationDialog } from "@/components/spots/verification/SpotWeatherVerificationDialog";
import { isWeatherIconName } from "@/lib/weather/isWeatherIcon";
import { CloudSun } from "lucide-react";
import {
  controlClass,
  iconButtonClass,
  tagClass,
} from "@/components/ui/recipes";
import { cn } from "@/lib/utils/cn";
import {
  formatDistanceValue,
  haversineMiles,
  milesToMeters,
} from "@/lib/spots/geo";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";

const PHOTO_ICON_BUTTON_CLASS = iconButtonClass("onPhoto");
const PHOTO_META_CLASS = tagClass("onPhoto");
const PHOTO_LINK_FOCUS_CLASS =
  "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";
/** Labelled actions share the row; Share and Waze are icon buttons. */
const ACTION_LABELLED_CLASS = "min-w-0 flex-1";

/** Focused spot of the "around" deep link, for "x mi from <spot>". */
export interface MapPopupAroundOrigin {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

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

function MapInfoPopupBase({
  events,
  aroundOrigin = null,
}: {
  events?: readonly MapEvent[];
  aroundOrigin?: MapPopupAroundOrigin | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const activePinId = useMapStore((s) => s.activePinId);
  const activeEventId = useMapStore((s) => s.activeEventId);
  const spots = useSpotsStore((s) => s.spots);
  const countrySpots = useSpotsStore((s) => s.countrySpots);
  const citySpots = useSpotsStore((s) => s.citySpots);
  const nearbySpots = useSpotsStore((s) => s.nearbySpots);
  const areaSpots = useSpotsStore((s) => s.areaSpots);
  const distanceUnit = useDistanceUnit();

  const { clearActivePin } = useMapActions();
  const event = useEventPopup(activeEventId, events);

  // The pin can point at a country-, city-, nearby- or area-scoped spot
  // (outside the capped base directory), so resolve against the union
  // of all slices.
  const resolvable = useMemo(
    () =>
      [spots, citySpots, countrySpots, nearbySpots, areaSpots].reduce(
        unionById,
        [] as readonly MapSpot[],
      ),
    [areaSpots, citySpots, countrySpots, nearbySpots, spots],
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
      // Map overlays that act on the open spot (the "around" bar) keep it.
      if (target instanceof Element && target.closest("[data-map-keep-popup]")) {
        return;
      }
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
  const aroundDistance =
    aroundOrigin && aroundOrigin.id !== spot.id
      ? formatDistanceValue(
          milesToMeters(
            haversineMiles(
              aroundOrigin.lat,
              aroundOrigin.lon,
              spot.location.lat,
              spot.location.lon,
            ),
          ),
          distanceUnit,
        )
      : null;
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
        className="fixed bottom-4 left-0 right-0 z-[1150] mx-auto flex max-h-[min(46dvh,360px)] w-auto flex-col overflow-hidden rounded-t-container border border-outline-variant bg-surface-bright pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] outline-none animate-slide-up md:absolute md:bottom-5 md:left-auto md:right-3 md:mx-0 md:max-h-[min(72vh,520px)] md:w-96 md:rounded-container md:pb-0 md:shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
      >
        {/* --- Image header: capped height so mobile map stays visible --- */}
        <div
          className={`group relative h-[148px] w-full shrink-0 overflow-hidden text-surface min-[380px]:h-[164px] md:h-[220px] ${
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
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 md:p-3.5">
            <div className="min-w-0 flex-1 pt-0.5"></div>

            <button
              type="button"
              onClick={clearActivePin}
              aria-label="Close spot details"
              className={PHOTO_ICON_BUTTON_CLASS}
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
              className={cn(
                controlClass("primary", "sm"),
                "absolute left-3 top-3 shadow-sm md:left-3.5 md:top-12",
              )}
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
              className={`${PHOTO_ICON_BUTTON_CLASS} absolute right-[60px] top-3 md:left-3.5 md:top-12`}
            >
              <CloudSun size={14} aria-hidden="true" />
            </button>
          )}

          {/* Bottom overlay: title + meta — guaranteed contrast via gradient above */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 md:p-3.5">
            <h2
              id={titleId}
              className="line-clamp-2 max-w-[92%] text-pretty font-display text-lg font-bold uppercase leading-[1.2] tracking-[-0.02em] text-surface [text-shadow:0_1px_16px_rgba(0,0,0,0.55)] md:max-w-[90%] md:text-xl"
              title={spot.name}
            >
              {spot.name}
            </h2>

            {/* Meta row: distance from the focused spot + city + verification + instagram */}
            <div className="flex flex-wrap items-center gap-1.5">
              {aroundDistance !== null && aroundOrigin ? (
                <span
                  className={PHOTO_META_CLASS}
                  title={`${aroundDistance} from ${aroundOrigin.name}`}
                >
                  <Route size={10} aria-hidden="true" className="shrink-0" />
                  <span>{aroundDistance} from</span>
                  <span className="max-w-[14ch] truncate">
                    {aroundOrigin.name}
                  </span>
                </span>
              ) : null}
              <span className={PHOTO_META_CLASS}>
                <MapPin size={10} aria-hidden="true" className="shrink-0" />
                <span className="max-w-[18ch] truncate">{spot.city}</span>
              </span>

              <span
                aria-label={verificationLabel}
                className={PHOTO_META_CLASS}
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
                  className={cn(PHOTO_META_CLASS, PHOTO_LINK_FOCUS_CLASS)}
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

        {/* --- Action bar: outside the image so header height stays capped --- */}
        <div className="flex shrink-0 items-center gap-1.5 bg-surface-bright px-2.5 py-2.5 md:gap-2 md:px-3.5 md:py-3">
          <Link prefetch={false}
            href={gamePrefillHref}
            onClick={() => clearActivePin()}
            aria-label={`Train or challenge at ${spot.name}`}
            className={cn(controlClass("primary"), ACTION_LABELLED_CLASS)}
          >
            <Swords size={12} aria-hidden="true" className="shrink-0" />
            <span>Train</span>
          </Link>

          <Link prefetch={false}
            href={`/spots/${spot.id}`}
            aria-label={`Open ${spot.name} details`}
            className={cn(controlClass("outline"), ACTION_LABELLED_CLASS)}
          >
            <span>Details</span>
            <ArrowUpRight size={12} aria-hidden="true" className="shrink-0" />
          </Link>

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label={`Share ${spot.name}`}
            title="Share"
            className={iconButtonClass("outline")}
          >
            <Share2 size={14} aria-hidden="true" />
          </button>

          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open directions to ${spot.name} in Waze (opens in a new tab)`}
            title="Directions in Waze"
            className={iconButtonClass("outline")}
          >
            <Navigation size={14} aria-hidden="true" />
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
