import { describe, expect, it } from "vitest";
import { splitIntoBatches } from "./useSpotWeather";

describe("splitIntoBatches", () => {
  it("keeps every item in batches no larger than the requested size", () => {
    expect(splitIntoBatches([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  it("rejects a non-positive batch size", () => {
    expect(() => splitIntoBatches([1], 0)).toThrow("Batch size must be positive");
  });
});
