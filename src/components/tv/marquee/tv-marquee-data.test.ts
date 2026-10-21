import { describe, it, expect } from "vitest";
import {
  filterByDiscipline,
  formatTvCategory,
  resolveDisciplineParam,
  toTvMarqueeItem,
  toTvMarqueeItems,
  withDisciplineParam,
  youtubeThumbUrl,
} from "./tv-marquee-data";
import type { TvVideo } from "@/types/tv";

function makeVideo(
  overrides: Partial<TvVideo> & Pick<TvVideo, "id"> & { categories?: readonly string[] },
): TvVideo {
  const { id, categories = ["profile"], ...rest } = overrides;
  return {
    id,
    title: `Video ${id}`,
    youtubeUrl: "https://youtu.be/abc123",
    embedUrl: "https://www.youtube.com/embed/abc123",
    disciplineSlug: "skateboard",
    categories,
    postDate: new Date(2026, 0, 15, 12).toISOString(),
    published: true,
    sortOrder: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest,
  };
}

describe("filterByDiscipline", () => {
  it('returns all videos when discipline is "all"', () => {
    const videos: TvVideo[] = [
      makeVideo({ id: "v1", categories: ["profile"], disciplineSlug: "roller" }),
      makeVideo({ id: "v2", categories: ["music"], disciplineSlug: "skateboard" }),
    ];
    expect(filterByDiscipline(videos, "all")).toEqual(videos);
    expect(filterByDiscipline(videos, "all")).not.toBe(videos);
  });

  it("filters by disciplineSlug case-insensitively", () => {
    const videos: TvVideo[] = [
      makeVideo({ id: "v1", categories: ["profile"], disciplineSlug: "Skateboard" }),
      makeVideo({ id: "v2", categories: ["music"], disciplineSlug: "roller" }),
    ];
    expect(filterByDiscipline(videos, "skateboard").map((v) => v.id)).toEqual(["v1"]);
  });
});


describe("toTvMarqueeItem", () => {
  it("maps video fields and formats the post date", () => {
    const video = makeVideo({ id: "v1", categories: ["profile", "event"] });
    const item = toTvMarqueeItem(video);
    expect(item.video).toBe(video);
    expect(item.title).toBe(video.title);
    expect(item.disciplineSlug).toBe("skateboard");
    expect(item.categories).toEqual(["profile", "event"]);
    expect(item.meta).toBe("Jan 15, 2026");
  });

  it("maps a YouTube watch URL to a widescreen mqdefault thumb", () => {
    const item = toTvMarqueeItem(
      makeVideo({ id: "v1", categories: ["music"], youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    );
    expect(item.thumb).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });

  it("returns a null thumb for a non-video URL", () => {
    const item = toTvMarqueeItem(
      makeVideo({ id: "v1", categories: ["lifestyle"], youtubeUrl: "https://not-a-video.example" }),
    );
    expect(item.thumb).toBeNull();
  });

  it("maps an empty list to an empty list", () => {
    expect(toTvMarqueeItems([])).toEqual([]);
  });
});

describe("youtubeThumbUrl", () => {
  it("accepts a canonical watch URL", () => {
    expect(youtubeThumbUrl("https://www.youtube.com/watch?v=abc12345678")).toBe(
      "https://i.ytimg.com/vi/abc12345678/mqdefault.jpg",
    );
  });

  it("returns null for invalid input", () => {
    expect(youtubeThumbUrl("https://example.com/foo")).toBeNull();
  });
});

describe("formatTvCategory", () => {
  it("capitalizes the category slug", () => {
    expect(formatTvCategory("music")).toBe("Music");
    expect(formatTvCategory("documentary")).toBe("Documentary");
  });
});

describe("resolveDisciplineParam", () => {
  const slugs = ["skateboard", "roller"];
  it("accepts a known slug case-insensitively", () => {
    expect(resolveDisciplineParam("Roller", slugs)).toBe("roller");
  });
  it("accepts 'all' as a valid discipline value", () => {
    expect(resolveDisciplineParam("all", slugs)).toBe("all");
    expect(resolveDisciplineParam("ALL", slugs)).toBe("all");
  });
  it("returns null for missing, blank, or unknown values", () => {
    expect(resolveDisciplineParam(null, slugs)).toBeNull();
    expect(resolveDisciplineParam(undefined, slugs)).toBeNull();
    expect(resolveDisciplineParam("  ", slugs)).toBeNull();
    expect(resolveDisciplineParam("ski", slugs)).toBeNull();
  });
});

describe("withDisciplineParam", () => {
  it("sets the discipline and preserves other params", () => {
    expect(withDisciplineParam("/tv", "?play=abc", "roller")).toBe(
      "/tv?play=abc&discipline=roller",
    );
  });
  it("sets the discipline for all and preserves other params", () => {
    expect(withDisciplineParam("/tv", "?discipline=roller", "all")).toBe(
      "/tv?discipline=all",
    );
    expect(
      withDisciplineParam("/tv", "?discipline=roller&play=abc", "all"),
    ).toBe("/tv?discipline=all&play=abc");
  });
  it("removes the param when falsy and returns a clean path when empty", () => {
    expect(withDisciplineParam("/tv", "?discipline=roller", "")).toBe("/tv");
    expect(
      withDisciplineParam("/tv", "?discipline=roller&play=abc", ""),
    ).toBe("/tv?play=abc");
  });
});
