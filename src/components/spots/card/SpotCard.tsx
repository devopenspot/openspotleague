"use client";

import { Heart, Trash2, MapPin, Instagram, ShieldCheck } from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import { SpotMapFallback } from "@/components/spots/card/SpotMapFallback";
import { memo, useCallback, type MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";
import { TypeBadges } from "@/components/spots/shared/TypeBadges";
import type { Spot } from "@/lib/types";

interface BaseSpotCardProps {
  spot: Spot;
  isSaved: boolean;
  onOpen: (spot: Spot) => void;
  onToggleSave: (id: string, meta?: { name?: string }) => void;
  isVerified?: boolean;
  onToggleVerify?: (id: string, meta?: { name?: string }) => void;
  className?: string;
}

const ROOT_CLASSES =
  "group relative flex w-full flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest text-left transition-colors hover:border-on-surface focus-within:border-on-surface";

const IMAGE_WRAPPER_CLASSES =
  "relative h-48 w-full overflow-hidden bg-surface-container";

const TOGGLE_BASE_CLASSES =
  "absolute top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border transition-[background-color,border-color,transform] hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

const TOGGLE_SAVED_CLASSES =
  "border-primary bg-primary text-on-primary hover:bg-primary/90";
const TOGGLE_DEFAULT_CLASSES =
  "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-high";

const OVERLAY_BUTTON_CLASSES =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-on-surface/20 bg-surface text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

function toggleAriaLabel(
  spot: Spot,
  isSaved: boolean,
  remove: boolean,
): string {
  if (remove || isSaved) {
    return `Remove ${spot.name} from saved spots`;
  }
  return `Save ${spot.name}`;
}

function verifyAriaLabel(spot: Spot, isVerified: boolean): string {
  return isVerified
    ? `Remove your verification of ${spot.name}`
    : `Verify ${spot.name} — confirm this spot is legit`;
}

function openAriaLabel(spot: Spot): string {
  const noun = spot.types.length === 1 ? "spot" : "spots";
  const typePart = spot.types.length
    ? ` (${spot.types.map((t) => t.name).join(", ")} ${noun})`
    : "";
  return `Open ${spot.name} in ${spot.city}${typePart}`;
}

function verificationCountLabel(count: number): string {
  if (count === 0) return "No verifications yet";
  if (count === 1) return "Verified by 1 rider";
  return `Verified by ${count} riders`;
}

function BaseSpotCardImpl({
  spot,
  isSaved,
  onOpen,
  onToggleSave,
  isVerified = false,
  onToggleVerify,
  className,
  toggleIconVariant,
  removeCopy,
}: BaseSpotCardProps & {
  toggleIconVariant: "heart" | "trash";
  removeCopy: boolean;
}) {
  const handleOpen = useCallback(() => onOpen(spot), [onOpen, spot]);
  const handleToggle = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onToggleSave(spot.id, { name: spot.name });
    },
    [onToggleSave, spot.id, spot.name],
  );
  const handleVerify = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onToggleVerify?.(spot.id, { name: spot.name });
    },
    [onToggleVerify, spot.id, spot.name],
  );
  const handleInstagram = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  }, []);

  const showRemoveIcon = toggleIconVariant === "trash";
  const ToggleIcon = showRemoveIcon ? Trash2 : Heart;
  const toggleClassName = showRemoveIcon
    ? isSaved
      ? ""
      : "text-error"
    : isSaved
      ? "fill-on-primary"
      : "";

  const hasInstagram = Boolean(spot.instagram);
  const showVerifyButton = Boolean(onToggleVerify);
  const hasImage = Boolean(spot.image?.trim());

  return (
    <div data-spot-card className={cn(ROOT_CLASSES, className)}>
      <div className={IMAGE_WRAPPER_CLASSES}>
        <button
          type="button"
          onClick={handleOpen}
          aria-label={openAriaLabel(spot)}
          className="absolute inset-0 z-0 cursor-pointer"
        >
          {hasImage ? (
            <AppImage
              src={spot.image}
              alt={spot.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none"
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
          <div
            className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-on-surface/10 to-transparent pointer-events-none"
            aria-hidden="true"
          />
          <div className="absolute bottom-4 left-4 right-4 text-surface md:bottom-6 md:left-6 md:right-6 truncate">
            {spot.types.length > 0 ? (
              <div className="mb-2">
                <TypeBadges types={spot.types} variant="overlay" />
              </div>
            ) : null}
            {(spot.types.length > 0 || spot.sports.length > 0) && (
              <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {spot.sports.length > 0 && (
                  <div className="flex items-center gap-2">
                    <dd className="font-display text-xs font-bold uppercase tracking-widest text-surface">
                      {spot.sports.join(", ")}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <h2 className="mt-4 text-nowrap truncate pt-4 border-t border-outline-variant/40 font-display text-2xl font-bold tracking-wide leading-tight uppercase sm:text-3xl text-left">
              {spot.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <p className="flex items-center text-xs text-surface">
                <MapPin
                  size={12}
                  className="mr-1 shrink-0"
                  aria-hidden="true"
                />
                {`${spot.city} · ${spot.country}`}
              </p>
              {spot.verificationCount > 0 && (
                <p
                  className="flex items-center font-display text-xs font-bold uppercase tracking-widest text-surface"
                  aria-label={verificationCountLabel(spot.verificationCount)}
                >
                  <ShieldCheck
                    size={11}
                    className="mr-1 shrink-0"
                    aria-hidden="true"
                  />
                  {spot.verificationCount}
                </p>
              )}
            </div>
          </div>
        </button>

        {hasInstagram && (
          <a
            href={spot.instagram ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleInstagram}
            aria-label={`${spot.name} on Instagram (opens in a new tab)`}
            className={cn(OVERLAY_BUTTON_CLASSES, "top-3 left-3 absolute")}
          >
            <Instagram size={13} aria-hidden="true" />
          </a>
        )}

        {showVerifyButton && (
          <button
            type="button"
            onClick={handleVerify}
            aria-pressed={isVerified}
            aria-label={verifyAriaLabel(spot, isVerified)}
            className={cn(
              TOGGLE_BASE_CLASSES,
              isVerified
                ? "border-primary bg-primary text-on-primary hover:bg-primary/90"
                : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-high",
              hasInstagram ? "right-14" : "right-3",
            )}
          >
            <ShieldCheck
              size={14}
              aria-hidden="true"
              className={isVerified ? "fill-on-primary" : ""}
            />
          </button>
        )}

        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={isSaved}
          aria-label={toggleAriaLabel(spot, isSaved, removeCopy)}
          className={cn(
            TOGGLE_BASE_CLASSES,
            "right-3",
            isSaved ? TOGGLE_SAVED_CLASSES : TOGGLE_DEFAULT_CLASSES,
          )}
        >
          <ToggleIcon
            size={14}
            aria-hidden="true"
            className={toggleClassName}
          />
        </button>
      </div>
    </div>
  );
}

export const ExploreSpotCard = memo(function ExploreSpotCard(
  props: BaseSpotCardProps,
) {
  return (
    <BaseSpotCardImpl {...props} toggleIconVariant="heart" removeCopy={false} />
  );
});

export const SavedSpotCard = memo(function SavedSpotCard(
  props: BaseSpotCardProps,
) {
  return (
    <BaseSpotCardImpl {...props} toggleIconVariant="trash" removeCopy={true} />
  );
});
