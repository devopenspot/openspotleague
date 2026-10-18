"use client";

import { useEventsStore } from "@/stores/events-store";
import type { MapEvent } from "@/types/sport-events";

/**
 * Read the active event for the map's info popup. Returns `null`
 * when no event is selected, or when the active id is not in the
 * server-rendered event set. The events list is hydrated by
 * `MapProvider` from the layout fan-out (see SPEC §6.6.1).
 */
export function useEventPopup(
  activeEventId: string | null,
  visibleEvents?: readonly MapEvent[],
): MapEvent | null {
  const storedEvents = useEventsStore((s) => s.events);
  const events = visibleEvents ?? storedEvents;
  if (!activeEventId) return null;
  return events.find((e) => e.id === activeEventId) ?? null;
}
