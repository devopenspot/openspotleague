import { describe, expect, it } from "vitest"
import {
  normalizeTrick,
  selectMissingCanonicalTricks,
} from "./trick-catalog-store"

describe("trick catalog canonicalization", () => {
  it("trims, de-duplicates, and sorts compatible spot types", () => {
    expect(normalizeTrick({
      sourceId: " cess-slide ",
      name: " Cess Slide ",
      description: " Lay the skate down. ",
      level: 1,
      compatibleSpotTypes: ["plaza", " ledges", "box", "plaza"], categories: [],
    })).toEqual({
      sourceId: "cess-slide",
      name: "Cess Slide",
      description: "Lay the skate down.",
      level: 1,
      compatibleSpotTypes: ["box", "ledges", "plaza"], categories: [],
    })
  })

  it("does not re-import existing trick IDs during a normal seed", () => {
    expect(selectMissingCanonicalTricks(
      new Set(["boardslide"]),
      [
        {
          sourceId: "boardslide",
          name: "Curator Boardslide",
          description: "A curator edit.",
          level: 2,
          compatibleSpotTypes: ["rails"], categories: [],
        },
        {
          sourceId: "new-trick",
          name: "New Trick",
          description: "A new fixture entry.",
          level: 1,
          compatibleSpotTypes: ["bowl"], categories: [],
        },
      ],
    )).toEqual([
      {
        sourceId: "new-trick",
        name: "New Trick",
        description: "A new fixture entry.",
        level: 1,
        compatibleSpotTypes: ["bowl"], categories: [],
      },
    ])
  })
})
