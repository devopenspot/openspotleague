import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePreferencesSchema } from "@/lib/schemas/preferences";

const requireUserMock = vi.fn();
const ensurePreferenceProfileMock = vi.fn();
const getPreferencesMock = vi.fn();
const updatePreferencesMock = vi.fn();

const { MockProfileNotFoundError } = vi.hoisted(() => {
  class MockProfileNotFoundError extends Error {
    constructor(userId: string) {
      super(`Profile not found for user ${userId}`);
      this.name = "ProfileNotFoundError";
    }
  }
  return { MockProfileNotFoundError };
});

vi.mock("@/lib/auth/server", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/services/profile/preferences", () => ({
  ProfileNotFoundError: MockProfileNotFoundError,
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

describe("/api/preferences GET", () => {
  it("returns private, uncached account preferences", async () => {
    getPreferencesMock.mockResolvedValue(preferences);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(preferences);
    expect(getPreferencesMock).toHaveBeenCalledWith(user.id);
  });

  it("returns 401 when user is not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when profile is not found", async () => {
    getPreferencesMock.mockRejectedValue(new MockProfileNotFoundError("user-1"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Profile unavailable" });
  });

  it("returns 500 on unexpected errors", async () => {
    getPreferencesMock.mockRejectedValue(new Error("DB failure"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Profile unavailable" });
  });
});

describe("/api/preferences PATCH", () => {
  it("returns the canonical saved preferences with private cache headers", async () => {
    updatePreferencesMock.mockResolvedValue(preferences);

    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(preferences);
    expect(updatePreferencesMock).toHaveBeenCalledWith(user.id, preferences);
  });

  it("handles 'all' discipline preferences successfully", async () => {
    const allPreferences = {
      distanceUnit: "mi",
      temperatureUnit: "C",
      disciplineSlug: "all",
    };
    updatePreferencesMock.mockResolvedValue(allPreferences);

    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ disciplineSlug: "all" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(allPreferences);
    expect(updatePreferencesMock).toHaveBeenCalledWith(user.id, { disciplineSlug: "all" });
  });

  it("returns 400 with details when Zod validation fails", async () => {
    const parseResult = updatePreferencesSchema.safeParse({ disciplineSlug: 123 });
    expect(parseResult.success).toBe(false);
    if (parseResult.success) return;
    updatePreferencesMock.mockRejectedValue(parseResult.error);

    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ disciplineSlug: 123 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid preferences");
    expect(body.details).toBeDefined();
  });

  it("returns 400 for malformed JSON body", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: "{malformed json",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 401 when not signed in", async () => {
    requireUserMock.mockRejectedValue(new Error("Not signed in"));

    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ disciplineSlug: "bmx" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when profile provisioning fails", async () => {
    ensurePreferenceProfileMock.mockRejectedValue(new Error("Profile provisioning timed out"));

    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ disciplineSlug: "bmx" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Profile unavailable" });
  });

  it("returns 500 on unexpected server/DB error", async () => {
    updatePreferencesMock.mockRejectedValue(new Error("Database connection closed"));

    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ disciplineSlug: "bmx" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to update preferences" });
  });
});
