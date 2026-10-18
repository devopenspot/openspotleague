import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { MapEvent } from "@/types/sport-events";

/**
 * Server-rendered events for the map layer. Hydrated once by
 * `MapProvider` from the layout's `listEventsForMap()` call. Not a
 * source of truth for the layer toggle — that lives in the URL via
 * `useMapLayer`. This store is the read path for the map's
 * `EventMarker` and `MapInfoPopup`.
 */
interface EventsState {
  events: readonly MapEvent[];
  setEvents: (events: readonly MapEvent[]) => void;
}

export const useEventsStore = create<EventsState>()(
  devtools(
    (set) => ({
      events: [],
      setEvents: (events) => set({ events }),
    }),
    { name: "EventsStore", enabled: process.env.NODE_ENV === "development" },
  ),
);
