"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useUser } from "@/lib/contexts/user-context";
import { ROUTES } from "@/lib/navigation/nav";
import { useMapStore } from "@/stores/map-store";
import type { RequestedMapMode } from "@/components/map/shared/map-mode";

export interface MapActions {
  selectMode: (next: RequestedMapMode) => void;
  clearActivePin: () => void;
  dismissNearby: () => void;
  dismissSaved: () => void;
  clearLocationAndNearby: () => void;
}

function buildMapUrl(searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${ROUTES.map}?${query}` : ROUTES.map;
}

export function useMapActions(): MapActions {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clear: clearLocation } = useUserLocation();
  const setActivePin = useMapStore((s) => s.setActivePin);
  const user = useUser();
  const [, startTransition] = useTransition();

  const selectMode = useCallback(
    (next: RequestedMapMode) => {
      if (next === "saved" && user === null) {
        startTransition(() => {
          router.push(
            `/login?next=${encodeURIComponent(`${ROUTES.map}?saved=1`)}`,
          );
        });
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (next === "nearby") {
        params.set("nearby", "1");
        params.delete("saved");
      } else if (next === "saved") {
        params.set("saved", "1");
        params.delete("nearby");
      } else {
        params.delete("nearby");
        params.delete("saved");
      }
      const url = buildMapUrl(params);
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    },
    [router, searchParams, user],
  );

  const dismissNearby = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("nearby");
    const url = buildMapUrl(params);
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  }, [router, searchParams]);

  const dismissSaved = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    const url = buildMapUrl(params);
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  }, [router, searchParams]);

  const clearLocationAndNearby = useCallback(() => {
    clearLocation();
    dismissNearby();
  }, [clearLocation, dismissNearby]);

  const clearActivePin = useCallback(() => setActivePin(null), [setActivePin]);

  return {
    selectMode,
    clearActivePin,
    dismissNearby,
    dismissSaved,
    clearLocationAndNearby,
  };
}
