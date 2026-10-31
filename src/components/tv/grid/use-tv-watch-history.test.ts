import { describe, it, expect } from "vitest";
import {
  applyTvWatch,
  parseTvHistory,
  TV_HISTORY_MAX,
  type TvHistoryEntry,
} from "./use-tv-watch-history";

function entry(id: string, t = 30, d = 100): TvHistoryEntry {
  return { id, t, d, at: 1 };
}

describe("applyTvWatch", () => {
  it("puts the newest video first", () => {
    const next = applyTvWatch([entry("a"), entry("b")], entry("c"));
    expect(next.map((v) => v.id)).toEqual(["c", "a", "b"]);
  });

  it("moves an existing video to the front with its new position", () => {
    const next = applyTvWatch([entry("a"), entry("b")], entry("b", 60));
    expect(next.map((v) => v.id)).toEqual(["b", "a"]);
    expect(next[0]?.t).toBe(60);
  });

  it("caps the list length", () => {
    const list = Array.from({ length: TV_HISTORY_MAX }, (_, i) =>
      entry(`id${i}`),
    );
    const next = applyTvWatch(list, entry("new"));
    expect(next).toHaveLength(TV_HISTORY_MAX);
    expect(next[0]?.id).toBe("new");
    expect(next.some((v) => v.id === `id${TV_HISTORY_MAX - 1}`)).toBe(false);
  });

  it("ignores a video until 10 seconds have been watched", () => {
    const list = [entry("a")];
    expect(applyTvWatch(list, entry("b", 9))).toBe(list);
    expect(applyTvWatch(list, entry("b", 10)).map((v) => v.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("keeps updating a started video even after a rewind", () => {
    const next = applyTvWatch([entry("a", 60)], entry("a", 5));
    expect(next[0]?.t).toBe(5);
  });

  it("removes a video at 90% watched", () => {
    const next = applyTvWatch([entry("a"), entry("b")], entry("a", 90));
    expect(next.map((v) => v.id)).toEqual(["b"]);
  });

  it("keeps a video with an unknown duration", () => {
    const next = applyTvWatch([], entry("a", 10, 0));
    expect(next.map((v) => v.id)).toEqual(["a"]);
  });
});

describe("parseTvHistory", () => {
  it("keeps v1 ids as entries with no progress", () => {
    expect(parseTvHistory(JSON.stringify(["a", "b"]))).toEqual([
      { id: "a", t: 0, d: 0, at: 0 },
      { id: "b", t: 0, d: 0, at: 0 },
    ]);
  });

  it("reads v2 entries and skips malformed ones", () => {
    expect(
      parseTvHistory(JSON.stringify([entry("a"), { id: 3 }, null])),
    ).toEqual([entry("a")]);
  });

  it("treats bad JSON and non-arrays as empty", () => {
    expect(parseTvHistory("{oops")).toEqual([]);
    expect(parseTvHistory('{"a":1}')).toEqual([]);
    expect(parseTvHistory(null)).toEqual([]);
  });
});
