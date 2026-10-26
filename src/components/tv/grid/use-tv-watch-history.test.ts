import { describe, it, expect } from "vitest";
import { pushTvHistory, TV_HISTORY_MAX } from "./use-tv-watch-history";

describe("pushTvHistory", () => {
  it("puts the newest id first", () => {
    expect(pushTvHistory(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });
  it("de-duplicates by moving an existing id to the front", () => {
    expect(pushTvHistory(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });
  it("caps the list length", () => {
    const list = Array.from({ length: TV_HISTORY_MAX }, (_, i) => `id${i}`);
    const next = pushTvHistory(list, "new");
    expect(next).toHaveLength(TV_HISTORY_MAX);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`id${TV_HISTORY_MAX - 1}`);
  });
});
