import { describe, expect, it } from "vitest"
import { metadata } from "./layout"

describe("games metadata", () => {
  it("uses the training share card for social previews", () => {
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "/og/og-games-training.png", width: 1200, height: 630, alt: "Open Spot training and battles" }],
    })
    expect(metadata.twitter).toMatchObject({
      images: ["/og/og-games-training.png"],
    })
  })
})
