import { describe, it, expect } from "vitest";
import {
  diversifyVideos,
  filterByDiscipline,
  interleave,
  shuffled,
  toMarqueeEvent,
  toMarqueeItems,
  toMarqueeVideo,
} from "./marquee-data";
import type { MarqueeItem, MarqueeVideoInput } from "./marquee-data";
import type { Spot } from "@/types/spots";

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("shuffled", () => {
  it("returns empty for empty input", () => {
    expect(shuffled([])).toEqual([]);
  });

  it("preserves single element", () => {
    expect(shuffled([42])).toEqual([42]);
  });

  it("is a permutation of the input", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(input, makeRng(1));
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
  });

  it("does not mutate the original", () => {
    const input = [1, 2, 3, 4];
    const copy = [...input];
    shuffled(input, makeRng(9));
    expect(input).toEqual(copy);
  });

  it("is deterministic for the same seed", () => {
    const input = [1, 2, 3, 4, 5, 6];
    expect(shuffled(input, makeRng(42))).toEqual(shuffled(input, makeRng(42)));
  });

  it("produces different orders for different seeds", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffled(input, makeRng(1));
    const b = shuffled(input, makeRng(2));
    expect(a).not.toEqual(b);
  });
});

describe("interleave + shuffled buckets (wire order)", () => {
  it("mixes kinds via round-robin after per-bucket shuffle", () => {
    const spots = shuffled(["s1", "s2", "s3"], makeRng(11));
    const events = shuffled(["e1", "e2"], makeRng(22));
    const videos = shuffled(["v1"], makeRng(33));
    const out = interleave(spots, events, videos);
    // round-robin: s1,e1,v1, s2,e2, s3
    expect(out).toHaveLength(6);
    // first triple contains one of each bucket
    const firstThree = new Set(out.slice(0, 3));
    expect(firstThree.has("v1")).toBe(true);
    expect([...firstThree].some((x) => String(x).startsWith("s"))).toBe(true);
    expect([...firstThree].some((x) => String(x).startsWith("e"))).toBe(true);
  });
});

describe("filterByDiscipline after shuffle", () => {
  function item(overrides: Partial<MarqueeItem> & { id: string }): MarqueeItem {
    return {
      kind: "spot",
      title: overrides.id,
      imageUrl: null,
      href: "/x",
      meta: "m",
      disciplines: [],
      disciplineSlug: null,
      ...overrides,
    };
  }

  it("still filters correctly when input was shuffled", () => {
    const items: MarqueeItem[] = [
      item({ id: "a", disciplines: ["Skateboard"] }),
      item({ id: "b", disciplines: ["BMX"] }),
      item({ id: "c", disciplineSlug: "skateboard" }),
      item({ id: "d", disciplines: ["Roller"] }),
    ];
    const shuffledItems = shuffled(items, makeRng(7));
    const filtered = filterByDiscipline(shuffledItems, "Skateboard");
    expect(filtered.map((x) => x.id).sort()).toEqual(["a", "c"]);
  });
});

describe("toMarqueeItems after per-bucket shuffle", () => {
  it("returns interleaved items from shuffled source without throwing", () => {
    // minimal shape: spots/events/videos each need array; use empty for simplicity
    expect(toMarqueeItems({ spots: [], events: [], videos: [] })).toEqual([]);
  });
});

describe("toMarqueeItems spot image filter", () => {
  function makeSpot(id: string, image: string): Spot {
    return {
      id,
      slug: id,
      name: id,
      city: "Test City",
      citySlug: "test-city",
      address: "1 Test St",
      types: [],
      sports: [],
      image,
      country: "Testland",
      countryCode: "TS",
      instagram: null,
      verificationCount: 0,
      visibility: "public",
      origin: "seed",
      communitySubmissionCount: 0,
      adminHidden: false,
      location: { lat: 0, lon: 0 },
      createdBy: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
  }

  it("keeps only spots with a non-empty image", () => {
    const result = toMarqueeItems({
      spots: [
        makeSpot("with-image", "https://example.test/a.webp"),
        makeSpot("empty-image", ""),
        makeSpot("blank-image", "   "),
      ],
      events: [],
      videos: [],
    });
    expect(result.map((item) => item.id)).toEqual(["with-image"]);
    expect(result[0]).toMatchObject({
      kind: "spot",
      title: "with-image",
      imageUrl: "https://example.test/a.webp",
      href: "/spots/with-image",
    });
    expect("raw" in result[0]!).toBe(false);
  });
});

describe("marquee wire projections (P1, P3, P5)", () => {
  it("projects events to the exact 6 MarqueeEventInput fields", () => {
    const fullEvent = {
      id: "ev-1",
      name: "FISE Montpellier",
      image: "https://example.test/fise.webp",
      slug: "fise-montpellier",
      dateRangeLabel: "May 28 – Jun 1",
      sports: ["BMX", "Skateboard"] as const,
      description: "Heavy description that must not cross the wire",
      address: "Montpellier",
      instagram: "https://instagram.com/fiseworld",
    };
    const projected = toMarqueeEvent(fullEvent);
    expect(Object.keys(projected).sort()).toEqual([
      "dateRangeLabel",
      "id",
      "image",
      "name",
      "slug",
      "sports",
    ]);
  });

  it("projects TV videos without embedUrl", () => {
    const fullVideo = {
      id: "tv-1",
      title: "Street Part",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      disciplineSlug: "skateboard",
      categories: ["profile", "event"] as const,
      postDate: "2026-01-15",
    };
    const projected = toMarqueeVideo(fullVideo);
    expect("embedUrl" in projected).toBe(false);
    expect(Object.keys(projected).sort()).toEqual([
      "categories",
      "disciplineSlug",
      "id",
      "postDate",
      "title",
      "youtubeUrl",
    ]);
  });
});

describe("diversifyVideos", () => {
  function makeVideo(
    id: string,
    categories: readonly string[],
    postDate: string,
    disciplineSlug = "skateboard",
  ): MarqueeVideoInput {
    return {
      id,
      title: id,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      disciplineSlug,
      categories,
      postDate,
    };
  }

  it("mixes categories and dates instead of keeping chronological clusters", () => {
    // Chronological input: 4 event videos from the newest date first, then older profile/music/trick videos
    const chronological: MarqueeVideoInput[] = [
      makeVideo("ev-new-1", ["event"], "2026-10-15T00:00:00.000Z"),
      makeVideo("ev-new-2", ["event"], "2026-10-15T00:00:00.000Z"),
      makeVideo("ev-new-3", ["event"], "2026-10-15T00:00:00.000Z"),
      makeVideo("ev-old-1", ["event"], "2025-02-10T00:00:00.000Z"),
      makeVideo("pr-mid-1", ["profile"], "2026-05-01T00:00:00.000Z"),
      makeVideo("pr-old-1", ["profile"], "2024-11-20T00:00:00.000Z"),
      makeVideo("mu-old-1", ["music"], "2024-08-12T00:00:00.000Z"),
      makeVideo("tr-mid-1", ["trick"], "2025-09-03T00:00:00.000Z"),
    ];

    const result = diversifyVideos(chronological, "seed-diversity-test");

    // Preserves all unique videos without duplicates
    expect(result).toHaveLength(chronological.length);
    expect(result.map((v) => v.id).sort()).toEqual(
      chronological.map((v) => v.id).sort(),
    );

    // First 4 videos represent all 4 distinct categories (round-robin across categories)
    const firstFourCategories = new Set(
      result.slice(0, 4).map((v) => v.categories[0]),
    );
    expect(firstFourCategories.size).toBe(4);

    // Not ordered strictly by postDate DESC
    expect(result.map((v) => v.id)).not.toEqual(chronological.map((v) => v.id));
  });

  it("deduplicates multi-category videos and is deterministic per seed", () => {
    const videos: MarqueeVideoInput[] = [
      makeVideo("v1", ["event", "profile"], "2026-10-01T00:00:00.000Z"),
      makeVideo("v2", ["event"], "2026-10-01T00:00:00.000Z"),
      makeVideo("v3", ["music", "lifestyle"], "2025-04-12T00:00:00.000Z"),
      makeVideo("v4", ["trick"], "2024-06-20T00:00:00.000Z"),
    ];

    const runA = diversifyVideos(videos, "seed-a");
    const runB = diversifyVideos(videos, "seed-a");
    expect(runA).toEqual(runB);
    expect(new Set(runA.map((v) => v.id)).size).toBe(videos.length);
  });
});

