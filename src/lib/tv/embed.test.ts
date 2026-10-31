import { describe, expect, it } from "vitest";
import { toAutoplayEmbedUrl } from "./embed";

const EMBED = "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=0";

describe("toAutoplayEmbedUrl", () => {
  it("adds a whole-second start when resuming", () => {
    const url = new URL(toAutoplayEmbedUrl(EMBED, { startSeconds: 127.8 }));
    expect(url.searchParams.get("start")).toBe("127");
  });

  it("leaves start off from the beginning", () => {
    const url = new URL(toAutoplayEmbedUrl(EMBED, { startSeconds: 0 }));
    expect(url.searchParams.has("start")).toBe(false);
  });
});
