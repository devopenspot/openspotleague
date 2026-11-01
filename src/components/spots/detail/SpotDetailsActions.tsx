"use client";

import { Heart, ShieldCheck, Share2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { showToast } from "@/hooks/ui/useToast";
import { shareOrCopyUrl } from "@/lib/utils/share";
import { getOrFetchShortUrl } from "@/lib/utils/short-url";
import { LocationBlockedCallout } from "@/components/ui/LocationBlockedCallout";
import type { Spot } from "@/lib/types";

const ACTION_CLASS =
  "flex min-h-12 items-center gap-1.5 rounded-lg border-2 px-3 font-display text-sm font-bold uppercase tracking-[0.04em] transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px sm:px-4";
const ACTION_OFF_CLASS =
  "border-outline-variant bg-surface text-on-surface hover:bg-surface-container";
const ACTION_ON_CLASS =
  "border-primary bg-primary text-on-primary hover:bg-primary/95";

interface SpotDetailsActionsProps {
  spot: Spot;
  isSaved: boolean;
  isVerified: boolean;
  onToggleSave: (id: string, meta?: { name?: string }) => void;
  onToggleVerify: (id: string, meta?: { name?: string }) => void;
  burstKey: number;
  locationStatus: string;
  onRequestLocation: () => void;
}

export function SpotDetailsActions({
  spot,
  isSaved,
  isVerified,
  onToggleSave,
  onToggleVerify,
  burstKey,
  locationStatus,
  onRequestLocation,
}: SpotDetailsActionsProps) {
  const handleShare = async () => {
    try {
      const target = spot?.id ? `/spots/${spot.id}` : (typeof window !== "undefined" ? window.location.pathname : "");
      const urlToShare = await getOrFetchShortUrl(target, spot.name);
      const result = await shareOrCopyUrl(urlToShare, spot.name);
      if (result === "shared") showToast("Share sheet opened.", "success");
      else if (result === "copied") showToast("Link copied to clipboard", "success");
      else showToast("Sharing not supported in this browser", "error");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  return (
    <>
      <div
        role="group"
        aria-label="Spot actions"
        className="flex flex-wrap items-center justify-start gap-2 pb-5"
      >
        <button
          type="button"
          onClick={() => onToggleVerify(spot.id, { name: spot.name })}
          aria-pressed={isVerified}
          aria-label={
            isVerified
              ? `Remove your verification of ${spot.name}`
              : `Verify ${spot.name} — confirm this spot is legit`
          }
          className={cn(
            ACTION_CLASS,
            isVerified ? ACTION_ON_CLASS : ACTION_OFF_CLASS,
          )}
        >
          <ShieldCheck
            size={14}
            aria-hidden="true"
            className={cn(isVerified ? "fill-on-primary" : "")}
          />
          <span>{isVerified ? "Verified" : "Verify"}</span>
        </button>
        <button
          type="button"
          onClick={() => onToggleSave(spot.id, { name: spot.name })}
          aria-pressed={isSaved}
          aria-label={isSaved ? `Unsave ${spot.name}` : `Save ${spot.name}`}
          className={cn(ACTION_CLASS, isSaved ? ACTION_ON_CLASS : ACTION_OFF_CLASS)}
        >
          <span key={burstKey} aria-hidden="true" className="inline-flex">
            <Heart
              size={14}
              aria-hidden="true"
              className={cn(isSaved ? "fill-on-primary" : "", "animate-heart-burst")}
            />
          </span>
          <span>{isSaved ? "Saved" : "Save"}</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label={`Share ${spot.name}`}
          className={cn(ACTION_CLASS, ACTION_OFF_CLASS)}
        >
          <Share2 size={14} aria-hidden="true" />
          <span>Share</span>
        </button>
      </div>

      {locationStatus === "denied" ? (
        <LocationBlockedCallout onRetry={onRequestLocation} className="mb-4" />
      ) : null}
    </>
  );
}
