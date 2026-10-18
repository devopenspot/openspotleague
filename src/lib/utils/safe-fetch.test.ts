import { describe, expect, it } from "vitest";
import { withSafeDefaultResult } from "./safe-fetch";

describe("withSafeDefaultResult", () => {
  it("returns the value and ready status when the fetch succeeds", async () => {
    await expect(
      withSafeDefaultResult(async () => ({ items: ["spot"] }), { items: [] }, "spots"),
    ).resolves.toEqual({ value: { items: ["spot"] }, degraded: false });
  });

  it("returns the fallback and degraded status when the fetch fails", async () => {
    await expect(
      withSafeDefaultResult(
        async () => {
          throw new Error("database unavailable");
        },
        { items: [] },
        "spots",
      ),
    ).resolves.toEqual({ value: { items: [] }, degraded: true });
  });
});
