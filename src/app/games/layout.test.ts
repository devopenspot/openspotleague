import { describe, expect, it } from "vitest"
import { metadata } from "./layout"

describe("games metadata", () => {
  it("uses the challenge artwork for social previews", () => {
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "/challenges.jpg", alt: "Open Spot training and challenges" }],
    })
    expect(metadata.twitter).toMatchObject({
      images: ["/challenges.jpg"],
    })
  })
})
