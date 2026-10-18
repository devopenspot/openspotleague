import { beforeEach, describe, expect, it, vi } from "vitest";

const { findTvCardByIdMock } = vi.hoisted(() => ({
  findTvCardByIdMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

vi.mock("@/lib/services/tv/tv", () => ({
  findTvCardById: (...args: unknown[]) => findTvCardByIdMock(...args),
  listTvCategoryRows: vi.fn(),
  countTvByDiscipline: vi.fn(),
}));

vi.mock("@/lib/services/taxonomy/taxonomy", () => ({
  listSports: vi.fn(),
}));

vi.mock("@/lib/services/profile/preferences", () => ({
  getPreferences: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
}));

import { generateMetadata } from "./page";
import { env } from "@/lib/config/env";

const CARD = {
  id: "vid-1",
  title: "Night Session",
  youtubeUrl: "https://www.youtube.com/watch?v=abc123",
  embedUrl: "https://www.youtube.com/embed/abc123",
  disciplineSlug: "skateboard",
  categories: ["music", "profile"],
  postDate: "2026-01-05T12:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("tv metadata", () => {
  it("returns the generic TV card when no video is linked", async () => {
    const result = await generateMetadata({
      searchParams: Promise.resolve({}),
    });
    const expected = new URL("/opengrapgh-tv.png", env.APP_URL).toString();

    expect(result.title).toBe("TV — Open Spot");
    expect(result.openGraph).toMatchObject({
      images: [{ url: expected, alt: "OpenSpot TV" }],
    });
    expect(result.twitter).toMatchObject({ images: [expected] });
    expect(findTvCardByIdMock).not.toHaveBeenCalled();
  });

  it("uses the video name, date, and static TV image for a shared video", async () => {
    findTvCardByIdMock.mockResolvedValue(CARD);
    const expected = new URL("/opengrapgh-tv.png", env.APP_URL).toString();

    const result = await generateMetadata({
      searchParams: Promise.resolve({ play: "vid-1" }),
    });

    expect(result.title).toBe("Night Session");
    expect(result.openGraph).toMatchObject({
      title: "Night Session",
      images: [{ url: expected, alt: "Night Session" }],
    });
    expect(result.openGraph?.description).toContain("Music");
    expect(result.openGraph?.description).toContain("skateboard");
    expect(result.openGraph?.description).toContain("Jan 5, 2026");
    expect(result.twitter).toMatchObject({ images: [expected] });
    expect(findTvCardByIdMock).toHaveBeenCalledWith("vid-1");
  });

  it("supports the v alias for the play param", async () => {
    findTvCardByIdMock.mockResolvedValue(CARD);

    const result = await generateMetadata({
      searchParams: Promise.resolve({ v: "vid-1" }),
    });

    expect(result.title).toBe("Night Session");
    expect(findTvCardByIdMock).toHaveBeenCalledWith("vid-1");
  });

  it("falls back to the generic TV card when the video is unavailable", async () => {
    findTvCardByIdMock.mockResolvedValue(null);
    const expected = new URL("/opengrapgh-tv.png", env.APP_URL).toString();

    const result = await generateMetadata({
      searchParams: Promise.resolve({ play: "missing" }),
    });

    expect(result.title).toBe("TV — Open Spot");
    expect(result.openGraph).toMatchObject({
      images: [{ url: expected }],
    });
  });
});
