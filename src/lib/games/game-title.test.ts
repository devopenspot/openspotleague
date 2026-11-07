import { describe, expect, it } from "vitest";
import { dottedWord, gameTitle } from "@/lib/games/game-title";

describe("gameTitle", () => {
  it.each([
    ["Play a Skate", "Game of S.K.A.T.E"],
    ["Play a Blade", "Game of B.L.A.D.E"],
    ["Play a Bike", "Game of B.I.K.E"],
    ["Play a Scoot", "Game of S.C.O.O.T"],
  ])("%s → %s", (gameName, title) => {
    expect(gameTitle({ gameName })).toBe(title);
  });

  it("prefers the elimination word when the game carries one", () => {
    expect(gameTitle({ gameName: "Play a Skate", eliminationWord: "skate" })).toBe(
      "Game of S.K.A.T.E",
    );
  });

  it("accepts 'Play an …'", () => {
    expect(gameTitle({ gameName: "Play an Ollie" })).toBe("Game of O.L.L.I.E");
  });

  it("passes any other name through unchanged", () => {
    expect(gameTitle({ gameName: "Sunday Jam" })).toBe("Sunday Jam");
  });

  it("dots a word", () => {
    expect(dottedWord("bike")).toBe("B.I.K.E");
  });
});
