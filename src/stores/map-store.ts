import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface MapState {
  activePinId: string | null;
  activeEventId: string | null;
  isWeatherEnabled: boolean;
  isWeatherFetching: boolean;
  setActivePin: (id: string | null) => void;
  toggleActivePin: (id: string) => void;
  setActiveEvent: (id: string | null) => void;
  toggleActiveEvent: (id: string) => void;
  clearActivePins: () => void;
  setWeatherEnabled: (value: boolean) => void;
  toggleWeatherEnabled: () => void;
  setWeatherFetching: (value: boolean) => void;
}

export const useMapStore = create<MapState>()(
  devtools(
    (set) => ({
      activePinId: null,
      activeEventId: null,
      isWeatherEnabled: false,
      isWeatherFetching: false,
      setActivePin: (id) =>
        set({ activePinId: id, activeEventId: null }),
      toggleActivePin: (id) =>
        set((s) => {
          if (s.activePinId === id) {
            return { activePinId: null };
          }
          return { activePinId: id, activeEventId: null };
        }),
      setActiveEvent: (id) =>
        set({ activeEventId: id, activePinId: null }),
      toggleActiveEvent: (id) =>
        set((s) => {
          if (s.activeEventId === id) {
            return { activeEventId: null };
          }
          return { activeEventId: id, activePinId: null };
        }),
      clearActivePins: () => set({ activePinId: null, activeEventId: null }),
      setWeatherEnabled: (value) => set({ isWeatherEnabled: value }),
      toggleWeatherEnabled: () =>
        set((s) => ({ isWeatherEnabled: !s.isWeatherEnabled })),
      setWeatherFetching: (value) => set({ isWeatherFetching: value }),
    }),
    { name: "MapStore", enabled: process.env.NODE_ENV === "development" },
  ),
);
