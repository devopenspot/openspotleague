import { Suspense } from "react";
import { connection } from "next/server";
import { listEventsForMap } from "@/lib/services/event/events";
import { getCommonDirectoryData } from "@/lib/services/spot/directory";
import {
	EMPTY_SPOT_LIST,
	withSafeDefaultResult,
} from "@/lib/utils/safe-fetch";
import type { Region, SpotTypeEntity } from "@/lib/types";
import { MapProvider } from "@/components/map/panels/MapProvider";
import { MapShell } from "@/components/map/layout/MapShell";
import { MapSkeleton } from "./MapSkeleton";

const EMPTY_EVENTS_FOR_MAP: readonly never[] = [];

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapDataProviders>{children}</MapDataProviders>
    </Suspense>
  );
}

async function MapDataProviders({ children }: { children: React.ReactNode }) {
  await connection();
  // Each fan-out thunk is wrapped in `withSafeDefaultResult` so a single DB
  // call failing (bad env, paused project, network partition) cannot
  // crash the whole layout — see AGENTS.md "anonymous browsing works
  // even when Supabase env is missing."
  // Gating is via the single global gate inside `withDbRetry`
  // (no double-gating via `withDbConcurrency`).
  //
  // RootLayout (`SpotsProvider`) already hydrates `regions` and `spotTypes`
  // and wraps the tree in `UserProvider`, `WeatherProvider`,
  // `SavedSpotsProvider`, `VerifiedSpotsProvider`, and `HydrationGate`.
  // MapLayout only needs the capped map spot working set and map events.
  const [directoryResult, initialEvents] = await Promise.all([
    withSafeDefaultResult(
      () => getCommonDirectoryData(),
      {
        spots: EMPTY_SPOT_LIST,
        regions: [] as readonly Region[],
        spotTypes: [] as readonly SpotTypeEntity[],
      },
      "getCommonDirectoryData",
    ),
    withSafeDefaultResult(
      () => listEventsForMap(null),
      EMPTY_EVENTS_FOR_MAP,
      "listEventsForMap",
    ),
  ]);
  const initialSpots = directoryResult.degraded
    ? EMPTY_SPOT_LIST.items
    : directoryResult.value.spots.items;
  return (
    <MapProvider
      initialSpots={initialSpots}
      initialEvents={initialEvents.value}
      dataStatus={{
        spots: directoryResult.degraded ? "degraded" : "ready",
        events: initialEvents.degraded ? "degraded" : "ready",
      }}
    >
      <MapShell>{children}</MapShell>
    </MapProvider>
  );
}
