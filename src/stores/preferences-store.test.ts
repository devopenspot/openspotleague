import { beforeEach, describe, expect, it } from "vitest";
import { usePreferencesStore } from "./preferences-store";

describe("user preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.getState().reset();
  });

  it("stores only one selected sport", () => {
    usePreferencesStore.getState().setPreferredSport("BMX");
    expect(usePreferencesStore.getState().preferredSport).toBe("BMX");

    usePreferencesStore.getState().setPreferredSport("Roller");
    expect(usePreferencesStore.getState().preferredSport).toBe("Roller");
  });

  it("stores the selected temperature unit", () => {
    usePreferencesStore.getState().setTemperatureUnit("F");
    expect(usePreferencesStore.getState().temperatureUnit).toBe("F");
  });

  it("marks guest preferences as local and account hydration with its owner", () => {
    usePreferencesStore.getState().setPreferences({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
    });
    expect(usePreferencesStore.getState()).toMatchObject({
      preferenceAccountId: null,
      hasLocalChanges: true,
    });

    usePreferencesStore.getState().setPreferences({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
    }, { accountId: "user-1", hasLocalChanges: false });
    expect(usePreferencesStore.getState()).toMatchObject({
      preferenceAccountId: "user-1",
      hasLocalChanges: false,
    });
  });

  it("persists canonical account preferences in local storage", () => {
    usePreferencesStore.getState().setPreferences(
      { distanceUnit: "km", temperatureUnit: "F", preferredSport: "BMX" },
      { accountId: "user-1", hasLocalChanges: false },
    );

    const persisted = JSON.parse(
      localStorage.getItem("openspot-preferences") ?? "{}",
    ) as { state?: Record<string, unknown> };

    expect(persisted.state).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
      preferenceAccountId: "user-1",
      hasLocalChanges: false,
    });
  });
});
