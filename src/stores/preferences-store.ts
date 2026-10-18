import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import {
  SPORT_DISCIPLINES,
  type SportDiscipline,
} from "@/types/sport-events";

export type DistanceUnit = "mi" | "km";
export type TemperatureUnit = "C" | "F";
export type PreferencesHydrationStatus = "idle" | "loading" | "ready" | "error";

export const DEFAULT_DISTANCE_UNIT: DistanceUnit = "mi";
export const DEFAULT_TEMPERATURE_UNIT: TemperatureUnit = "C";
export const PREFERENCES_STORAGE_KEY = "openspot-preferences";

const LEGACY_PREFERENCES_STORAGE_KEY = "openspot-preferences-v2";

interface PreferencesState {
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  preferredSport: SportDiscipline | null;
  hydrationStatus: PreferencesHydrationStatus;
  preferenceAccountId: string | null;
  hasLocalChanges: boolean;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setPreferredSport: (sport: SportDiscipline | null) => void;
  setPreferences: (preferences: {
    distanceUnit: DistanceUnit;
    temperatureUnit: TemperatureUnit;
    preferredSport: SportDiscipline | null;
  }, metadata?: {
    accountId?: string | null;
    hasLocalChanges?: boolean;
  }) => void;
  setHydrationStatus: (status: PreferencesHydrationStatus) => void;
  reset: () => void;
}

const defaults = {
  distanceUnit: DEFAULT_DISTANCE_UNIT,
  temperatureUnit: DEFAULT_TEMPERATURE_UNIT,
  preferredSport: null,
  hydrationStatus: "idle" as PreferencesHydrationStatus,
  preferenceAccountId: null,
  hasLocalChanges: false,
} satisfies Pick<
  PreferencesState,
  | "distanceUnit" | "temperatureUnit" | "preferredSport"
  | "hydrationStatus" | "preferenceAccountId" | "hasLocalChanges"
>;

type PersistedPreferences = Pick<
  PreferencesState,
  | "distanceUnit"
  | "temperatureUnit"
  | "preferredSport"
  | "preferenceAccountId"
  | "hasLocalChanges"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function migratePreferences(state: unknown): PersistedPreferences {
  const persisted = isRecord(state) ? state : {};
  const preferredSport = SPORT_DISCIPLINES.includes(
    persisted.preferredSport as SportDiscipline,
  )
    ? (persisted.preferredSport as SportDiscipline)
    : null;
  const legacySource = persisted.preferenceSource;
  const accountId =
    typeof persisted.preferenceAccountId === "string" &&
    persisted.preferenceAccountId.length > 0
      ? persisted.preferenceAccountId
      : null;

  return {
    distanceUnit: persisted.distanceUnit === "km" ? "km" : DEFAULT_DISTANCE_UNIT,
    temperatureUnit: persisted.temperatureUnit === "F" ? "F" : DEFAULT_TEMPERATURE_UNIT,
    preferredSport,
    preferenceAccountId: accountId,
    hasLocalChanges:
      typeof persisted.hasLocalChanges === "boolean"
        ? persisted.hasLocalChanges
        : legacySource !== "account" && preferredSport !== null,
  };
}

const preferencesStorage = {
  getItem(name: string) {
    const current = localStorage.getItem(name);
    if (current || name !== PREFERENCES_STORAGE_KEY) return current;

    const legacy = localStorage.getItem(LEGACY_PREFERENCES_STORAGE_KEY);
    if (!legacy) return null;

    try {
      localStorage.setItem(name, legacy);
      localStorage.removeItem(LEGACY_PREFERENCES_STORAGE_KEY);
    } catch {
      return legacy;
    }
    return legacy;
  },
  setItem(name: string, value: string) {
    localStorage.setItem(name, value);
  },
  removeItem(name: string) {
    localStorage.removeItem(name);
  },
};

export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    persist(
      (set) => ({
        ...defaults,
        setDistanceUnit: (distanceUnit) =>
          set({ distanceUnit, preferenceAccountId: null, hasLocalChanges: true }),
        setTemperatureUnit: (temperatureUnit) =>
          set({ temperatureUnit, preferenceAccountId: null, hasLocalChanges: true }),
        setPreferredSport: (preferredSport) =>
          set({ preferredSport, preferenceAccountId: null, hasLocalChanges: true }),
        setPreferences: (
          { distanceUnit, temperatureUnit, preferredSport },
          metadata = {},
        ) => {
          const accountId = metadata.accountId ?? null;
          set({
            distanceUnit,
            temperatureUnit,
            preferredSport,
            preferenceAccountId: accountId,
            hasLocalChanges: metadata.hasLocalChanges ?? accountId === null,
          });
        },
        setHydrationStatus: (hydrationStatus) => set({ hydrationStatus }),
        reset: () => set({ ...defaults, hydrationStatus: "ready" }),
      }),
      {
        name: PREFERENCES_STORAGE_KEY,
        storage: createJSONStorage(() => preferencesStorage),
        skipHydration: true,
        version: 1,
        migrate: (state) => migratePreferences(state),
        partialize: ({ distanceUnit, temperatureUnit, preferredSport, preferenceAccountId, hasLocalChanges }) => ({
          distanceUnit,
          temperatureUnit,
          preferredSport,
          preferenceAccountId,
          hasLocalChanges,
        }),
      },
    ),
    {
      name: "PreferencesStore",
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);
