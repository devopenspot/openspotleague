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
      className="group flex min-h-9 items-center gap-1.5 rounded-full border border-on-primary-container bg-on-primary-container px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary transition-colors duration-150 ease-out hover:bg-on-primary-container/90 active:bg-on-primary-container/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-wait disabled:opacity-60"
    >
      <MapPin
        size={14}
        aria-hidden="true"
        className={cn(isRequesting && "animate-pulse-dot")}
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
