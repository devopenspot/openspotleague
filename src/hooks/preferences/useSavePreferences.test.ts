import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSavePreferences } from "./useSavePreferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { sportPreferenceFromSlug, sportPreferenceToSlug } from "@/types/disciplines";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => auth.user,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  auth.user = null;
  localStorage.clear();
  usePreferencesStore.getState().reset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sport slug mapping", () => {
  it("round-trips every preference", () => {
    expect(sportPreferenceToSlug("BMX")).toBe("bmx");
    expect(sportPreferenceToSlug("all")).toBe("all");
    expect(sportPreferenceToSlug(null)).toBeNull();
    expect(sportPreferenceFromSlug("skateboard")).toBe("Skateboard");
    expect(sportPreferenceFromSlug("all")).toBe("all");
    expect(sportPreferenceFromSlug("unicycle")).toBeNull();
    expect(sportPreferenceFromSlug(null)).toBeNull();
  });
});

describe("useSavePreferences", () => {
  it("keeps a signed-out rider's choice on this device for the guest sync", async () => {
    const { result } = renderHook(() => useSavePreferences());
    await act(() =>
      result.current({ distanceUnit: "km", temperatureUnit: "F", preferredSport: "Roller" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(usePreferencesStore.getState()).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "F",
      preferredSport: "Roller",
      preferenceAccountId: null,
      hasLocalChanges: true,
    });
  });

  it("PATCHes the account and stores what the server saved", async () => {
    auth.user = { id: "user-1" };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ distanceUnit: "km", temperatureUnit: "C", disciplineSlug: "bmx" }),
    });
    const { result } = renderHook(() => useSavePreferences());
    await act(() =>
      result.current({ distanceUnit: "km", temperatureUnit: "C", preferredSport: "BMX" }),
    );

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/preferences");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      distanceUnit: "km",
      temperatureUnit: "C",
      disciplineSlug: "bmx",
    });
    expect(usePreferencesStore.getState()).toMatchObject({
      distanceUnit: "km",
      temperatureUnit: "C",
      preferredSport: "BMX",
      preferenceAccountId: "user-1",
      hasLocalChanges: false,
    });
  });

  it("throws and leaves the store alone when the save fails", async () => {
    auth.user = { id: "user-1" };
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const before = usePreferencesStore.getState().distanceUnit;
    const { result } = renderHook(() => useSavePreferences());

    await expect(
      result.current({ distanceUnit: before === "mi" ? "km" : "mi", temperatureUnit: "C", preferredSport: null }),
    ).rejects.toThrow();
    expect(usePreferencesStore.getState().distanceUnit).toBe(before);
  });
});
