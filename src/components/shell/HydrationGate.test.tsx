import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "@/lib/contexts/user-context";
import { HydrationGate } from "./HydrationGate";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUIStore } from "@/stores/ui-store";

const user = {
  id: "user-1",
  name: "Rider",
  email: "rider@example.com",
  initials: "R",
  avatarUrl: null,
  canAccessAdmin: false,
  canCurate: false,
  isAdministrator: false,
};

describe("HydrationGate", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.getState().reset();
    useUIStore.getState().closeOnboarding();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates account preferences and mirrors them to local storage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          distanceUnit: "km",
          temperatureUnit: "F",
          disciplineSlug: "bmx",
        }),
      }),
    );

    render(
      <UserProvider user={user}>
        <HydrationGate>
          <span>content</span>
        </HydrationGate>
      </UserProvider>,
    );

    await waitFor(() =>
      expect(usePreferencesStore.getState().hydrationStatus).toBe("ready"),
    );

    expect(usePreferencesStore.getState()).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
      preferenceAccountId: "user-1",
      hasLocalChanges: false,
    });

    const persisted = JSON.parse(
      localStorage.getItem("openspot-preferences") ?? "{}",
    ) as { state?: Record<string, unknown> };
    expect(persisted.state).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
      preferenceAccountId: "user-1",
    });
  });

  it("hydrates account preferences when disciplineSlug is 'all'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          distanceUnit: "mi",
          temperatureUnit: "C",
          disciplineSlug: "all",
        }),
      }),
    );

    render(
      <UserProvider user={user}>
        <HydrationGate>
          <span>content</span>
        </HydrationGate>
      </UserProvider>,
    );

    await waitFor(() =>
      expect(usePreferencesStore.getState().hydrationStatus).toBe("ready"),
    );

    expect(usePreferencesStore.getState()).toMatchObject({
      distanceUnit: "mi",
      temperatureUnit: "C",
      preferredSport: "all",
      preferenceAccountId: "user-1",
      hasLocalChanges: false,
    });
  });

  it("rehydrates guest preferences after a reload without calling the API", async () => {
    usePreferencesStore.getState().setPreferences(
      { distanceUnit: "km", temperatureUnit: "F", preferredSport: "BMX" },
      { accountId: null, hasLocalChanges: true },
    );
    const persisted = localStorage.getItem("openspot-preferences");
    expect(persisted).toContain('"preferredSport":"BMX"');
    usePreferencesStore.setState({
      distanceUnit: "mi",
      temperatureUnit: "C",
      preferredSport: null,
      preferenceAccountId: null,
      hasLocalChanges: false,
      hydrationStatus: "idle",
    });
    localStorage.setItem("openspot-preferences", persisted ?? "");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UserProvider user={null}>
        <HydrationGate>
          <span>content</span>
        </HydrationGate>
      </UserProvider>,
    );

    await waitFor(() =>
      expect(usePreferencesStore.getState().hydrationStatus).toBe("ready"),
    );

    expect(usePreferencesStore.getState()).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "BMX",
      preferenceAccountId: null,
      hasLocalChanges: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("migrates the previous storage key once", async () => {
    localStorage.removeItem("openspot-preferences");
    localStorage.setItem(
      "openspot-preferences-v2",
      JSON.stringify({
        state: {
          onboarded: true,
          distanceUnit: "km",
          temperatureUnit: "F",
          preferredSport: "Skateboard",
        },
        version: 0,
      }),
    );

    render(
      <UserProvider user={null}>
        <HydrationGate>
          <span>content</span>
        </HydrationGate>
      </UserProvider>,
    );

    await waitFor(() =>
      expect(usePreferencesStore.getState().hydrationStatus).toBe("ready"),
    );

    expect(usePreferencesStore.getState()).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "Skateboard",
      preferenceAccountId: null,
      hasLocalChanges: true,
    });
    expect(localStorage.getItem("openspot-preferences-v2")).toBeNull();
    expect(localStorage.getItem("openspot-preferences")).toContain(
      '"preferredSport":"Skateboard"',
    );
  });
});
