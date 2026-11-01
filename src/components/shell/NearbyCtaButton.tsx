"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { showToast } from "@/hooks/ui/useToast";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/navigation/nav";
import { setMapPreserveNearbyEntry } from "@/lib/map/preserve";

import { NEARBY_BUTTON_ID, statusMessage } from "./nearby-cta.messages";

export function NearbyCtaButton() {
  const router = useRouter();
  const { status, request } = useUserLocation();
  const isRequesting = status === "requesting";

  const handleClick = useCallback(async () => {
    if (isRequesting) return;
    const next = await request();
    if (next === "denied") {
      showToast(
        "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.",
        "error",
      );
    } else if (next === "unavailable") {
      showToast("Geolocation unavailable in this browser.", "error");
    } else if (next === "granted") {
      showToast("Location ready — opening map.", "success");
    }
    setMapPreserveNearbyEntry();
    router.push(`${ROUTES.map}?nearby=1`);
  }, [isRequesting, request, router]);

  return (
    <button
      id={NEARBY_BUTTON_ID}
      type="button"
      onClick={handleClick}
      disabled={isRequesting}
      aria-busy={isRequesting}
      aria-describedby={`${NEARBY_BUTTON_ID}-status`}
      className="group flex min-h-12 items-center gap-2 rounded-lg border-2 border-on-primary-container bg-on-primary-container px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-on-primary-container/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
    >
      <MapPin
        size={14}
        aria-hidden="true"
        className={cn(isRequesting && "-dot")}
      />
      <span>{isRequesting ? "Locating…" : "Nearby"}</span>
      <span
        id={`${NEARBY_BUTTON_ID}-status`}
        role="status"
        aria-live="polite"
        className="visually-hidden"
      >
        {statusMessage(status)}
      </span>
    </button>
  );
}
