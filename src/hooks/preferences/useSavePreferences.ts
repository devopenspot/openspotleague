"use client";

import { useCallback } from "react";
import {
  usePreferencesStore,
  type DistanceUnit,
  type TemperatureUnit,
} from "@/stores/preferences-store";
import { useUser } from "@/lib/contexts/user-context";
import {
  sportPreferenceFromSlug,
  sportPreferenceToSlug,
  type SportPreference,
} from "@/types/disciplines";

export interface PreferenceValues {
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  preferredSport: SportPreference | null;
}

/**
 * The one writer for rider preferences (Preferences dialog and the profile
 * Account tab). Signed in: PATCH /api/preferences, then store what the server
 * saved. Signed out: keep them on this device, flagged for the guest sync in
 * HydrationGate. Throws when the server rejects the save; the store is left
 * untouched in that case.
 */
export function useSavePreferences() {
  const user = useUser();
  const userId = user?.id ?? null;
  const setPreferences = usePreferencesStore((s) => s.setPreferences);

  return useCallback(
    async (values: PreferenceValues): Promise<void> => {
      if (!userId) {
        setPreferences(values, { accountId: null, hasLocalChanges: true });
        return;
      }
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          distanceUnit: values.distanceUnit,
          temperatureUnit: values.temperatureUnit,
          disciplineSlug: sportPreferenceToSlug(values.preferredSport),
        }),
      });
      if (!response.ok) {
        throw new Error("Preferences could not be saved");
      }
      const saved = (await response.json()) as {
        distanceUnit: DistanceUnit;
        temperatureUnit: TemperatureUnit;
        disciplineSlug: string | null;
      };
      setPreferences(
        {
          distanceUnit: saved.distanceUnit,
          temperatureUnit: saved.temperatureUnit,
          preferredSport: sportPreferenceFromSlug(saved.disciplineSlug),
        },
        { accountId: userId, hasLocalChanges: false },
      );
    },
    [userId, setPreferences],
  );
}
