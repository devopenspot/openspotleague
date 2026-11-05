import { describe, expect, it } from "vitest";
import { RATING_CRITERIA, RATING_CRITERIA_KEYS } from "./criteria";
import { REQUIRED_ELEMENTS, REVIEW_PENDING, elementIdsFor } from "./elements";
import { FORMAT_TEMPLATES, RATED_FORMATS, RATING_DISCIPLINES, divisionLabel } from "./formats";
import { isAllowedVideoUrl, normalizeVideoUrl } from "./video-links";

describe("formats (Article 9)", () => {
  it("uses the article's run lengths and the Street best trick", () => {
    expect(FORMAT_TEMPLATES.park).toMatchObject({ runSeconds: 50, hasBestTrick: false });
    expect(FORMAT_TEMPLATES.street).toMatchObject({ runSeconds: 50, hasBestTrick: true });
    expect(FORMAT_TEMPLATES.vert).toMatchObject({ runSeconds: 45, hasBestTrick: false });
  });
  it("labels divisions", () => {
    expect(divisionLabel("roller", "park")).toBe("Roller · Park");
    expect(divisionLabel("bmx", "open")).toBe("BMX · Open");
  });
});

describe("criteria", () => {
  it("are the five World Skate criteria with guidance for every format", () => {
    expect(RATING_CRITERIA.map((criterion) => criterion.key)).toEqual([...RATING_CRITERIA_KEYS]);
    for (const criterion of RATING_CRITERIA) {
      for (const format of RATED_FORMATS) {
        expect(criterion.guidance[format].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("required elements", () => {
  it("exist for every discipline and format, with unique ids and valid ranges", () => {
    for (const discipline of RATING_DISCIPLINES) {
      for (const format of RATED_FORMATS) {
        const set = REQUIRED_ELEMENTS[discipline][format];
        expect(set.elements.length).toBeGreaterThan(0);
        const ids = set.elements.map((element) => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const element of set.elements) {
          expect(element.min).toBeGreaterThan(0);
          expect(element.max).toBeGreaterThanOrEqual(element.min);
        }
      }
    }
  });

  it("matches Article 9 for Roller", () => {
    expect(REQUIRED_ELEMENTS.roller.park.elements.find((e) => e.id === "grinds")).toMatchObject({ min: 3, max: 5 });
    expect(REQUIRED_ELEMENTS.roller.street.elements.find((e) => e.id === "grinds")).toMatchObject({ min: 5, max: 8 });
    expect(REQUIRED_ELEMENTS.roller.vert.elements.find((e) => e.id === "walls")).toMatchObject({ min: 12, max: 18 });
    expect(REQUIRED_ELEMENTS.roller.vert.elements.find((e) => e.id === "grabbed-airs")).toMatchObject({ min: 5, max: 5 });
    expect(REQUIRED_ELEMENTS.roller.vert.elements.find((e) => e.id === "spins")).toMatchObject({ min: 2, max: 3 });
  });

  it("marks Roller reviewed and every other discipline pending review", () => {
    expect(REVIEW_PENDING.some((entry) => entry.discipline === "roller")).toBe(false);
    expect(REVIEW_PENDING).toHaveLength(9);
  });

  it("exposes the checklist ids", () => {
    expect([...elementIdsFor("roller", "park")]).toEqual(["rotation", "transfer-air", "grinds"]);
  });
});

describe("video links", () => {
  it("accepts the allowed hosts over https", () => {
    expect(normalizeVideoUrl(" https://www.youtube.com/watch?v=abc#t=3 ")).toBe("https://www.youtube.com/watch?v=abc");
    expect(isAllowedVideoUrl("https://youtu.be/abc")).toBe(true);
    expect(isAllowedVideoUrl("https://www.instagram.com/reel/abc/")).toBe(true);
    expect(isAllowedVideoUrl("https://vimeo.com/123")).toBe(true);
    expect(isAllowedVideoUrl("https://drive.google.com/file/d/abc/view")).toBe(true);
  });
  it("rejects other hosts, http and look-alikes", () => {
    expect(isAllowedVideoUrl("http://youtube.com/watch?v=abc")).toBe(false);
    expect(isAllowedVideoUrl("https://evil.com/youtube.com")).toBe(false);
    expect(isAllowedVideoUrl("https://notyoutube.com/watch")).toBe(false);
    expect(isAllowedVideoUrl("not a link")).toBe(false);
  });
});
