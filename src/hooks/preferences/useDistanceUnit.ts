import { usePreferencesStore } from "@/stores/preferences-store"

export function useDistanceUnit() {
  return usePreferencesStore((s) => s.distanceUnit)
}
