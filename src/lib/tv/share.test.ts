import { describe, expect, it } from "vitest";
import {
  TV_OG_IMAGE_PATH,
  buildTvShareDescription,
  buildTvSharePath,
  buildTvShareUrl,
  formatTvPostDate,
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
});
