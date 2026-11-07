import { describe, expect, it } from "vitest";
import {
  MAX_OG_IMAGE_BYTES,
  describeFetchError,
  imageProblems,
  parseShareTags,
  shareTagProblems,
} from "./check";

const PAGE = "https://openspotleague.com/league";

const html = (image: string, extra = "") => `<head>
  <meta property="og:image" content="${image}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:image" content="${image}"/>${extra}
</head>`;

describe("parseShareTags", () => {
  it("reads og and twitter image tags", () => {
    expect(parseShareTags(html("https://openspotleague.com/og/og-league.png"))).toEqual({
      image: "https://openspotleague.com/og/og-league.png",
      width: 1200,
      height: 630,
      twitterImage: "https://openspotleague.com/og/og-league.png",
    });
  });

  it("accepts content before property and decodes entities", () => {
    const tags = parseShareTags('<meta content="https://a.com/x.png?a=1&amp;b=2" property="og:image">');
    expect(tags.image).toBe("https://a.com/x.png?a=1&b=2");
  });

  it("does not confuse og:image:width with og:image", () => {
    const tags = parseShareTags('<meta property="og:image:width" content="1200"><meta property="og:image" content="https://a.com/i.png">');
    expect(tags.image).toBe("https://a.com/i.png");
  });

  it("returns nulls when tags are missing", () => {
    expect(parseShareTags("<head></head>")).toEqual({ image: null, width: null, height: null, twitterImage: null });
  });
});

describe("shareTagProblems", () => {
  it("passes a correct card on the page host", () => {
    const tags = parseShareTags(html("https://openspotleague.com/og/og-league.png"));
    expect(shareTagProblems(tags, PAGE)).toEqual([]);
  });

  it("flags an image on another host (the dead www case)", () => {
    const tags = parseShareTags(html("https://www.openspotleague.com/og/og-league.png"));
    expect(shareTagProblems(tags, PAGE)).toEqual([
      "og:image host www.openspotleague.com differs from the page host openspotleague.com (check APP_URL)",
    ]);
  });

  it("flags a missing tag, a relative URL and a wrong size", () => {
    expect(shareTagProblems(parseShareTags(""), PAGE)).toEqual(["no og:image tag"]);
    expect(shareTagProblems(parseShareTags(html("/og/og-league.png")), PAGE)[0]).toMatch(/not an absolute URL/);
    const small = parseShareTags(html("https://openspotleague.com/a.png").replace('content="630"', 'content="300"'));
    expect(shareTagProblems(small, PAGE)).toEqual(["declared size 1200x300, expected 1200x630"]);
  });
});

describe("imageProblems", () => {
  it("passes a small png", () => {
    expect(imageProblems({ status: 200, contentType: "image/png", bytes: 90_000 })).toEqual([]);
  });

  it("flags status, type and size", () => {
    expect(
      imageProblems({ status: 404, contentType: "text/html; charset=utf-8", bytes: MAX_OG_IMAGE_BYTES + 1 }),
    ).toEqual(["image returned HTTP 404", "image content-type is text/html", "image is 600 KB, over 600 KB"]);
  });
});

describe("describeFetchError", () => {
  it("explains a DNS failure", () => {
    const error = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    expect(describeFetchError(error, "https://www.openspotleague.com/og/a.png")).toBe(
      "host www.openspotleague.com does not resolve (no DNS record): crawlers cannot download it",
    );
  });

  it("explains a timeout", () => {
    const error = new DOMException("timed out", "TimeoutError");
    expect(describeFetchError(error, "https://a.com/x")).toBe("request to a.com timed out");
  });
});
