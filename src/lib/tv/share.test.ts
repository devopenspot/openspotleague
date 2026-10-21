import { describe, expect, it } from "vitest";
import {
  TV_OG_IMAGE_PATH,
  buildTvShareDescription,
  buildTvSharePath,
  buildTvShareUrl,
  formatTvPostDate,
  resolveTvOgImage,
} from "./share";
import type { TvCard } from "@/types/tv";

const CARD: TvCard = {
  id: "vid-1",
  title: "Night Session",
  youtubeUrl: "https://www.youtube.com/watch?v=abc123",
  embedUrl: "https://www.youtube.com/embed/abc123",
  disciplineSlug: "skateboard",
  categories: ["music", "profile"],
  postDate: "2026-01-05T12:00:00.000Z",
};

describe("tv share", () => {
  it("builds a minimal canonical share path", () => {
    expect(buildTvSharePath("vid-1")).toBe("/tv?play=vid-1");
    expect(buildTvSharePath("a b&c")).toBe("/tv?play=a%20b%26c");
  });

  it("builds an absolute URL when an origin is given", () => {
    expect(buildTvShareUrl("vid-1", "https://example.com")).toBe(
      "https://example.com/tv?play=vid-1",
    );
    expect(buildTvShareUrl("vid-1")).toBe("/tv?play=vid-1");
  });

  it("formats the post date like the marquee meta", () => {
    expect(formatTvPostDate("2026-01-05T12:00:00.000Z")).toBe("Jan 5, 2026");
    expect(formatTvPostDate("not-a-date")).toBe("");
  });

  it("describes the video with categories, discipline, and date", () => {
    expect(buildTvShareDescription(CARD)).toBe(
      "Music, Profile · skateboard · Jan 5, 2026 — Watch on OpenSpot TV",
    );
  });

  it("points at the static TV OG asset", () => {
    expect(TV_OG_IMAGE_PATH).toBe("/opengrapgh-tv.png");
  });

  describe("resolveTvOgImage", () => {
    const fallbackUrl = "https://example.com/opengrapgh-tv.png";

    it("returns the fallback static banner when video is null", () => {
      const result = resolveTvOgImage(null, fallbackUrl);
      expect(result).toEqual({
        url: fallbackUrl,
        width: 1200,
        height: 630,
        alt: "OpenSpot TV",
      });
    });

    it("resolves the YouTube thumbnail (480x360) when the video has a valid YouTube URL", () => {
      const result = resolveTvOgImage(CARD, fallbackUrl);
      expect(result).toEqual({
        url: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        width: 480,
        height: 360,
        alt: "Night Session",
      });
    });

    it("falls back to the static banner with video title when YouTube URL is invalid", () => {
      const invalidCard: TvCard = {
        ...CARD,
        youtubeUrl: "https://example.com/not-youtube",
      };
      const result = resolveTvOgImage(invalidCard, fallbackUrl);
      expect(result).toEqual({
        url: fallbackUrl,
        width: 1200,
        height: 630,
        alt: "Night Session",
      });
    });
  });
});
