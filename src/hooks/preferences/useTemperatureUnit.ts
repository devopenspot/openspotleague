import { usePreferencesStore } from "@/stores/preferences-store"

export function useTemperatureUnit() {
  return usePreferencesStore((s) => s.temperatureUnit)
}
