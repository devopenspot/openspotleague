import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "./preferences-store";
import { useUIStore } from "./ui-store";

describe("onboarding navigation state", () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
    useUIStore.getState().closeOnboarding();
  });

  it("runs protected actions immediately after onboarding is complete", () => {
    const action = vi.fn();
    usePreferencesStore.getState().setPreferences({
      distanceUnit: "mi",
      temperatureUnit: "C",
      preferredSport: "BMX",
    });

    useUIStore.getState().tryRun(action, "/saved");

    expect(action).toHaveBeenCalledOnce();
    expect(useUIStore.getState()).toMatchObject({
      isOnboardingOpen: false,
      pendingOnboardingAction: null,
      pendingOnboardingNext: null,
    });
  });

  it("runs protected actions immediately when preferredSport is 'all'", () => {
    const action = vi.fn();
    usePreferencesStore.getState().setPreferences({
      distanceUnit: "mi",
      temperatureUnit: "C",
      preferredSport: "all",
    });

    useUIStore.getState().tryRun(action, "/saved");

    expect(action).toHaveBeenCalledOnce();
    expect(useUIStore.getState()).toMatchObject({
      isOnboardingOpen: false,
      pendingOnboardingAction: null,
      pendingOnboardingNext: null,
    });
  });

  it("keeps the pending action destination until the dialog closes", () => {
    const action = vi.fn();

    useUIStore.getState().tryRun(action, "/map?saved=1");

    expect(useUIStore.getState()).toMatchObject({
      isOnboardingOpen: true,
      preferenceDialogMode: "onboarding",
      pendingOnboardingNext: "/map?saved=1",
    });
    expect(action).not.toHaveBeenCalled();

    useUIStore.getState().closeOnboarding();

    expect(useUIStore.getState()).toMatchObject({
      isOnboardingOpen: false,
      pendingOnboardingAction: null,
      pendingOnboardingNext: null,
    });
  });

  it("waits for preference hydration before evaluating a protected action", () => {
    const action = vi.fn();
    usePreferencesStore.getState().setPreferences({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
    });
    usePreferencesStore.getState().setHydrationStatus("loading");

    useUIStore.getState().tryRun(action, "/saved");

    expect(action).not.toHaveBeenCalled();
    expect(useUIStore.getState()).toMatchObject({
      isOnboardingOpen: false,
      pendingOnboardingNext: "/saved",
    });

    usePreferencesStore.getState().setHydrationStatus("ready");
    useUIStore.getState().resolvePendingOnboarding();

    expect(action).toHaveBeenCalledOnce();
    expect(useUIStore.getState().pendingOnboardingNext).toBeNull();
  });
});
