import { describe, expect, it } from "vitest";
import type { drizzle } from "drizzle-orm/postgres-js";
import { DrizzleShortLinkRepository } from "./drizzle-short-link-repository";
import type { ShortLink } from "@/db/schema";

function mockRow(code: string, targetUrl: string, title: string | null = null): ShortLink {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code,
    targetUrl,
    title,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("DrizzleShortLinkRepository", () => {
  it("findByCode returns row when found", async () => {
    const row = mockRow("7xK9q2A", "/spots/spot-1");
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([row]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof drizzle>;

    const repo = new DrizzleShortLinkRepository(mockDb);
    const result = await repo.findByCode("7xK9q2A");

    expect(result).toEqual(row);
  });

  it("findByCode returns null when not found", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof drizzle>;

    const repo = new DrizzleShortLinkRepository(mockDb);
    const result = await repo.findByCode("nonexistent");

    expect(result).toBeNull();
  });

  it("findByTargetUrl returns row when found", async () => {
    const row = mockRow("7xK9q2A", "/spots/spot-1", "Spot 1");
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([row]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof drizzle>;

    const repo = new DrizzleShortLinkRepository(mockDb);
    const result = await repo.findByTargetUrl("/spots/spot-1");

    expect(result).toEqual(row);
  });

  it("findByTargetUrl returns null when not found", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof drizzle>;

    const repo = new DrizzleShortLinkRepository(mockDb);
    const result = await repo.findByTargetUrl("/spots/spot-99");

    expect(result).toBeNull();
  });

  it("create inserts and returns the created short link", async () => {
    const createdRow = mockRow("7xK9q2A", "/spots/spot-1", "My Spot");
    let insertedValues: unknown;

    const mockDb = {
      insert: () => ({
        values: (val: unknown) => {
          insertedValues = val;
          return {
            returning: () => Promise.resolve([createdRow]),
          };
        },
      }),
    } as unknown as ReturnType<typeof drizzle>;

    const repo = new DrizzleShortLinkRepository(mockDb);
    const result = await repo.create({
      code: "7xK9q2A",
      targetUrl: "/spots/spot-1",
      title: "My Spot",
    });

    expect(result).toEqual(createdRow);
    expect(insertedValues).toEqual({
      code: "7xK9q2A",
      targetUrl: "/spots/spot-1",
      title: "My Spot",
    });
  });

  it("create throws error when insert returns empty", async () => {
    const mockDb = {
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    } as unknown as ReturnType<typeof drizzle>;

    const repo = new DrizzleShortLinkRepository(mockDb);
    await expect(
      repo.create({
        code: "7xK9q2A",
        targetUrl: "/spots/spot-1",
      }),
    ).rejects.toThrow("Failed to create short link row");
  });
});
