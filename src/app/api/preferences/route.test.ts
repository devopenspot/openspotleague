import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const ensurePreferenceProfileMock = vi.fn();
const getPreferencesMock = vi.fn();
const updatePreferencesMock = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/services/profile/preferences", () => ({
  ProfileNotFoundError: class ProfileNotFoundError extends Error {},
  ensurePreferenceProfile: (...args: unknown[]) => ensurePreferenceProfileMock(...args),
  getPreferences: (...args: unknown[]) => getPreferencesMock(...args),
  updatePreferences: (...args: unknown[]) => updatePreferencesMock(...args),
}));

import { GET, PATCH } from "./route";

const user = { id: "user-1" };
const preferences = {
  distanceUnit: "km",
  temperatureUnit: "F",
  disciplineSlug: "bmx",
};

beforeEach(() => {
  vi.resetAllMocks();
  requireUserMock.mockResolvedValue(user);
  ensurePreferenceProfileMock.mockResolvedValue(undefined);
});

describe("/api/preferences", () => {
  it("returns private, uncached account preferences", async () => {
    getPreferencesMock.mockResolvedValue(preferences);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(preferences);
    expect(getPreferencesMock).toHaveBeenCalledWith(user.id);
  });

  it("returns the canonical saved preferences with private cache headers", async () => {
    updatePreferencesMock.mockResolvedValue(preferences);

    const response = await PATCH(new Request("http://localhost/api/preferences", {
      method: "PATCH",
      body: JSON.stringify(preferences),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(preferences);
    expect(updatePreferencesMock).toHaveBeenCalledWith(user.id, preferences);
  });
});
