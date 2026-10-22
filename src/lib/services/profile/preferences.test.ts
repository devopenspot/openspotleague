import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSet = vi.fn();
const mockReturning = vi.fn();
const mockWhereUpdate = vi.fn();
const mockLimit = vi.fn();
const mockWhereSelect = vi.fn();

const mockTx = {
  update: vi.fn(() => ({
    set: mockSet.mockImplementation(() => ({
      where: mockWhereUpdate.mockImplementation(() => ({
        returning: mockReturning,
      })),
    })),
  })),
};

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: mockWhereSelect.mockImplementation(() => ({
        limit: mockLimit,
      })),
    })),
  })),
  transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};

vi.mock("@/lib/db/client", () => ({
  getDbClient: () => ({ db: mockDb }),
  withDbRead: vi.fn((_label: string, fn: () => Promise<unknown>) => fn()),
  withDbWrite: vi.fn((_label: string, fn: () => Promise<unknown>) => fn()),
}));

import {
  DEFAULT_PREFERENCES,
  getPreferences,
  ProfileNotFoundError,
  updatePreferences,
} from "./preferences";

describe("profile preferences service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DEFAULT_PREFERENCES", () => {
    it("has disciplineSlug set to 'all'", () => {
      expect(DEFAULT_PREFERENCES.disciplineSlug).toBe("all");
    });
  });

  describe("getPreferences", () => {
    it("maps preferredDisciplineSlug = null to 'all'", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "user-1",
          distanceUnit: "mi",
          temperatureUnit: "C",
          preferredDisciplineSlug: null,
        },
      ]);

      const result = await getPreferences("user-1");

      expect(result).toEqual({
        distanceUnit: "mi",
        temperatureUnit: "C",
        disciplineSlug: "all",
      });
    });

    it("maps existing preferredDisciplineSlug to the specific discipline", async () => {
      mockLimit.mockResolvedValueOnce([
        {
          id: "user-1",
          distanceUnit: "km",
          temperatureUnit: "F",
          preferredDisciplineSlug: "skateboard",
        },
      ]);

      const result = await getPreferences("user-1");

      expect(result).toEqual({
        distanceUnit: "km",
        temperatureUnit: "F",
        disciplineSlug: "skateboard",
      });
    });

    it("returns defaults when no profile row is found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await getPreferences("user-1");

      expect(result).toEqual({
        distanceUnit: "mi",
        temperatureUnit: "C",
        disciplineSlug: "all",
      });
    });
  });

  describe("updatePreferences", () => {
    it("persists null to database when disciplineSlug is 'all'", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "user-1",
          distanceUnit: "mi",
          temperatureUnit: "C",
          preferredDisciplineSlug: null,
        },
      ]);

      const result = await updatePreferences("user-1", {
        disciplineSlug: "all",
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredDisciplineSlug: null,
        }),
      );
      expect(result.disciplineSlug).toBe("all");
    });

    it("persists specific discipline slug when not 'all'", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "user-1",
          distanceUnit: "mi",
          temperatureUnit: "C",
          preferredDisciplineSlug: "bmx",
        },
      ]);

      const result = await updatePreferences("user-1", {
        disciplineSlug: "bmx",
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredDisciplineSlug: "bmx",
        }),
      );
      expect(result.disciplineSlug).toBe("bmx");
    });

    it("does not update preferredDisciplineSlug when not provided in patch", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "user-1",
          distanceUnit: "km",
          temperatureUnit: "C",
          preferredDisciplineSlug: "scooter",
        },
      ]);

      const result = await updatePreferences("user-1", {
        distanceUnit: "km",
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.not.objectContaining({
          preferredDisciplineSlug: expect.anything(),
        }),
      );
      expect(result.distanceUnit).toBe("km");
      expect(result.disciplineSlug).toBe("scooter");
    });

    it("throws ProfileNotFoundError when row update returns nothing", async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(
        updatePreferences("user-1", { distanceUnit: "mi" }),
      ).rejects.toThrow(ProfileNotFoundError);
    });
  });
});
