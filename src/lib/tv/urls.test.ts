import { describe, expect, it } from "vitest"
import { parseYouTubeVideoUrl } from "./urls"

describe("parseYouTubeVideoUrl", () => {
  it("normalizes YouTube watch and short links into paused embeds", () => {
    expect(
      parseYouTubeVideoUrl("https://youtu.be/RviTmnuvW5M?t=20"),
    ).toEqual({
      canonicalUrl: "https://www.youtube.com/watch?v=RviTmnuvW5M",
      embedUrl:
        "https://www.youtube-nocookie.com/embed/RviTmnuvW5M?autoplay=0&controls=1&playsinline=1&rel=0",
    })
  })

  it("rejects non-public or unsupported links", () => {
    expect(parseYouTubeVideoUrl("http://youtube.com/watch?v=abc123")).toBeNull()
    expect(parseYouTubeVideoUrl("https://www.youtube.com/@open-spot")).toBeNull()
    expect(parseYouTubeVideoUrl("https://example.com/watch?v=abc123")).toBeNull()
  })
})
