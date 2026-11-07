import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_OG_IMAGE_PATH,
  OG_IMAGES,
  contestOgCard,
  gameOgCard,
  ogImage,
} from "./config";

describe("OG_IMAGES", () => {
  it.each(Object.entries(OG_IMAGES))("%s ships in public/", (_key, path) => {
    expect(existsSync(join(process.cwd(), "public", path))).toBe(true);
  });

  it("uses the default card as the global fallback", () => {
    expect(DEFAULT_OG_IMAGE_PATH).toBe(OG_IMAGES.default);
  });
});

describe("ogImage", () => {
  it("declares the 1200x630 card size", () => {
    expect(ogImage(OG_IMAGES.league, "League")).toEqual({
      url: "/og/og-league.png",
      width: 1200,
      height: 630,
      alt: "League",
    });
  });
});

describe("gameOgCard", () => {
  it("picks the card by mode while a game is open", () => {
    expect(gameOgCard("challenge", "lobby")).toBe(OG_IMAGES.gamesBattle);
    expect(gameOgCard("challenge", "active")).toBe(OG_IMAGES.gamesBattle);
    expect(gameOgCard("training", "active")).toBe(OG_IMAGES.gamesTraining);
    expect(gameOgCard("training", "cancelled")).toBe(OG_IMAGES.gamesTraining);
  });

  it("shows the results card once a game is complete", () => {
    expect(gameOgCard("challenge", "complete")).toBe(OG_IMAGES.gamesResults);
    expect(gameOgCard("training", "complete")).toBe(OG_IMAGES.gamesResults);
  });
});

describe("contestOgCard", () => {
  it("shows the League card until the contest is completed", () => {
    expect(contestOgCard("upcoming")).toBe(OG_IMAGES.league);
    expect(contestOgCard("live")).toBe(OG_IMAGES.league);
    expect(contestOgCard("completed")).toBe(OG_IMAGES.leagueResults);
  });
});
