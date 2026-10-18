"use client";

import { AppImage } from "@/components/ui/AppImage";
import {
  AlertTriangle,
  Bookmark,
  Compass,
  Heart,
  MapPin,
  X,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useMapStore } from "@/stores/map-store";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";
import type { MapSpot } from "@/lib/types";
import {
  formatDistance,
  getSpotDistanceInfo,
  milesToMeters,
} from "@/lib/spots/geo";
import type { DistanceUnit } from "@/stores/preferences-store";
import { TypeBadges } from "@/components/spots/shared/TypeBadges";
import { groupSpotsByCity } from "@/components/map/shared/map-derived";
import { MAP_DISTANCE_UI_ENABLED } from "@/components/map/shared/map-feature-flags";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMapMode } from "@/components/map/hooks/use-map-mode";
import { useUIStore } from "@/stores/ui-store";
import type { MapDataStatus } from "@/components/map/panels/MapProvider";

interface MapSidebarProps {
  spots: readonly MapSpot[];
  distanceMilesById: ReadonlyMap<string, number>;
  onSelect: (spot: MapSpot) => void;
  dataStatus: MapDataStatus;
  className?: string;
  isGateActive?: boolean;
}

interface MapSidebarContentProps {
  spots: readonly MapSpot[];
  distanceMilesById: ReadonlyMap<string, number>;
  onSelect: (spot: MapSpot) => void;
  dataStatus: MapDataStatus;
  headingId: string;
  listId: string;
  onClose?: () => void;
  isGateActive?: boolean;
}

function MapSidebarContent({
  spots,
  distanceMilesById,
  onSelect,
  dataStatus,
  headingId,
  listId,
  onClose,
  isGateActive = false,
}: MapSidebarContentProps) {
  const activeId = useMapStore((s) => s.activePinId);
  const mapMode = useMapMode();
  const user = useUser();
  const { savedIds } = useSavedSpots(user?.id ?? null);
  const { status: locationStatus, location: userLocation } = useUserLocation();
  const distanceUnit = useDistanceUnit();
  const router = useRouter();

  const handleSelect = useCallback((spot: MapSpot) => onSelect(spot), [onSelect]);

  const distanceOrigin = userLocation;

  const groupedSpots = useMemo(
    () => groupSpotsByCity(spots, distanceOrigin, distanceMilesById),
    [distanceMilesById, distanceOrigin, spots],
  );

  const [userCity, setUserCity] = useState<string | null>(
    groupedSpots[0]?.key ?? null,
  );

  const openCity = useMemo(() => {
    if (activeId) {
      const key = groupedSpots.find((g) =>
        g.spots.some((s) => s.id === activeId),
      )?.key;
      if (key) return key;
    }
    if (userCity && groupedSpots.some((g) => g.key === userCity)) {
      return userCity;
    }
    return groupedSpots[0]?.key ?? null;
  }, [activeId, groupedSpots, userCity]);

  const nearbyReady =
    mapMode !== "nearby" ||
    (locationStatus === "granted" && userLocation !== null);
  const modeLabel =
    mapMode === "saved"
      ? "Saved spots"
      : mapMode === "nearby"
        ? nearbyReady
          ? "Nearby spots"
          : locationStatus === "denied"
            ? "Location blocked"
            : "Location needed"
        : "Spots in view";
  const statusMessages = [
    ...(dataStatus.spots === "degraded"
      ? ["Spot data is temporarily unavailable."]
      : []),
    ...(dataStatus.events === "degraded"
      ? ["Event data is temporarily unavailable."]
      : []),
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant bg-surface-bright px-4 py-4">
        <div className="min-w-0">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
            Map directory
          </p>
          <h2
            id={headingId}
            className="mt-1 truncate font-display text-lg font-bold uppercase tracking-tight text-on-surface"
          >
            {modeLabel}
          </h2>
          <p className="mt-1 font-display text-[10px] uppercase tracking-wider text-secondary">
            {spots.length} {spots.length === 1 ? "spot" : "spots"} available
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close spot list"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-secondary transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {statusMessages.length > 0 && (
        <div
          role="status"
          className="shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={14}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-error"
            />
            <div>
              <p className="font-display font-bold uppercase tracking-wide">
                Some data is limited
              </p>
              <ul className="mt-1 space-y-0.5 text-secondary">
                {statusMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div
        id={listId}
        role="region"
        aria-label={modeLabel}
        className="flex-1 flex flex-col overflow-y-auto no-scrollbar min-h-0"
      >
        <Accordion
          multiple={false}
          value={openCity === null ? [] : [openCity]}
          onValueChange={(v: string[]) => setUserCity(v[0] ?? null)}
        >
          {groupedSpots.map((group) => (
            <AccordionItem key={group.key} value={group.key}>
              <AccordionTrigger className="sticky top-0 z-10 min-h-11 bg-surface-bright px-3 py-2">
                <MapPin
                  size={10}
                  aria-hidden="true"
                  className="text-secondary shrink-0"
                />
                <span className="truncate">
                  {group.city}
                  {group.countryCode ? ` · ${group.countryCode}` : ""}
                </span>
                <span className="ml-auto text-secondary shrink-0">
                  {group.spots.length}{" "}
                  {group.spots.length === 1 ? "spot" : "spots"}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {group.spots.map((spot) => (
                  <SidebarSpotItem
                    key={spot.id}
                    spot={spot}
                    isActive={activeId === spot.id}
                    isSaved={savedIds.has(spot.id)}
                    distanceOrigin={distanceOrigin}
                    distanceMiles={distanceMilesById.get(spot.id)}
                    distanceUnit={distanceUnit}
                    onSelect={handleSelect}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {spots.length === 0 && dataStatus.spots === "ready" && (
          <div className="m-4 flex flex-col items-center justify-center bg-surface-container-low px-4 py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[4px] border border-outline-variant bg-surface-container-high text-secondary">
              <Heart size={20} className="text-secondary" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-on-surface">
              {isGateActive
                ? "Region & country required"
                : mapMode === "saved"
                  ? "No saved spots"
                  : mapMode === "nearby" && !nearbyReady
                    ? "Location needed"
                    : "No spots in view"}
            </h3>
            <p className="mt-2 text-xs text-secondary leading-relaxed">
              {isGateActive
                ? "Filtered map needs both a region and a country. Pick your area to load spots."
                : mapMode === "saved"
                  ? "Browse the directory and tap the save button on any spot to build your reference list."
                  : mapMode === "nearby" && !nearbyReady
                    ? "Allow location access to filter the directory around you."
                    : "No spots match the current filters. Try clearing them or zooming out."}
            </p>
            {isGateActive ? (
              <button
                type="button"
                onClick={() => useUIStore.getState().openSearch()}
                className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-3 font-display text-xs font-bold tracking-widest text-on-primary uppercase transition-colors hover:bg-primary/90"
              >
                <span>Choose area</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant px-3 font-display text-xs font-bold tracking-widest text-on-surface uppercase transition-colors hover:bg-surface-container"
              >
                <Compass size={14} aria-hidden="true" />
                <span>Explore</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MapSidebarBase({
  spots,
  distanceMilesById,
  onSelect,
  dataStatus,
  className,
  isGateActive = false,
}: MapSidebarProps) {
  return (
    <aside
      id="map-sidebar"
      aria-label="Spot list"
      className={cn(
        "hidden h-full w-80 flex-col overflow-hidden rounded-[8px] border border-outline-variant bg-surface-bright lg:flex",
        className,
      )}
      aria-labelledby="map-sidebar-desktop-title"
    >
      <MapSidebarContent
        spots={spots}
        distanceMilesById={distanceMilesById}
        onSelect={onSelect}
        dataStatus={dataStatus}
        headingId="map-sidebar-desktop-title"
        listId="map-sidebar-desktop-spots"
        isGateActive={isGateActive}
      />
    </aside>
  );
}

export const MapSidebar = memo(MapSidebarBase);
export { MapSidebarContent };

interface SidebarSpotItemProps {
  spot: MapSpot;
  isActive: boolean;
  isSaved: boolean;
  distanceOrigin: { lat: number; lon: number } | null;
  distanceMiles?: number;
  distanceUnit: DistanceUnit;
  onSelect: (spot: MapSpot) => void;
}

const SidebarSpotItem = memo(function SidebarSpotItem({
  spot,
  isActive,
  isSaved,
  distanceOrigin,
  distanceMiles,
  distanceUnit,
  onSelect,
}: SidebarSpotItemProps) {
  const distanceInfo =
    distanceMiles === undefined
      ? getSpotDistanceInfo(spot, distanceOrigin, distanceUnit)
      : {
          kind: "distance" as const,
          label: formatDistance(milesToMeters(distanceMiles), distanceUnit),
        };
  const showDistance =
    MAP_DISTANCE_UI_ENABLED && distanceInfo.kind === "distance";
  const distanceLabel = showDistance ? distanceInfo.label : "";

  const handleClick = useCallback(() => onSelect(spot), [onSelect, spot]);

  return (
    <button
      id={`sidebar-spot-item-${spot.id}`}
      type="button"
      onClick={handleClick}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "flex min-h-[80px] w-full items-stretch border text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        isActive
          ? "border-primary bg-primary/10"
          : "border-outline-variant/60 bg-surface-container-low hover:border-outline hover:bg-surface-container",
      )}
    >
      <span className="relative h-20 w-16 bg-surface-container-high overflow-hidden shrink-0">
        <AppImage
          src={spot.image}
          alt={spot.name}
          fill
          sizes="56px"
          className="object-cover"
          referrerPolicy="no-referrer"
          unoptimized
        />
      </span>

      <span className="flex-1 min-w-0 px-3 py-2 flex flex-col gap-1.5">
        <span className="flex items-center justify-between gap-2 min-w-0">
          {spot.types.length > 0 ? (
            <TypeBadges
              types={spot.types}
              variant="surface"
              className="text-[10px]"
            />
          ) : (
            <span className="font-display text-[10px] font-bold text-secondary uppercase tracking-widest">
              Spot
            </span>
          )}
          {showDistance && (
            <span className="font-display text-[10px] font-bold text-secondary uppercase tracking-widest shrink-0">
              {distanceLabel}
            </span>
          )}
          {isSaved && (
            <Bookmark
              size={12}
              aria-hidden="true"
              className="shrink-0 text-primary"
            />
          )}
        </span>
        <span className="block font-display text-xs font-bold tracking-wide uppercase text-on-surface truncate">
          {spot.name}
        </span>
        <span className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-display text-[10px] text-secondary uppercase tracking-widest truncate text-nowrap">
            {spot.sports.join(" · ")}
          </span>
        </span>
        {isSaved && <span className="visually-hidden">Saved spot</span>}
      </span>
    </button>
  );
});
