import { describe, expect, it } from "vitest"
import { decodeSpotCursor, encodeSpotCursor } from "./spot-pagination"

describe("spot pagination cursor", () => {
  const cursor = {
    slug: "central-plaza",
    id: "00000000-0000-4000-8000-000000000001",
  }

  it("round-trips the complete ordering tuple", () => {
    expect(decodeSpotCursor(encodeSpotCursor(cursor))).toEqual(cursor)
  })

  it("rejects malformed and unsupported cursors", () => {
    expect(decodeSpotCursor("not-a-cursor")).toBeNull()
    expect(decodeSpotCursor(undefined)).toBeNull()

    const value = Buffer.from(
      JSON.stringify({ v: 2, slug: cursor.slug, id: cursor.id }),
    ).toString("base64url")
    expect(decodeSpotCursor(value)).toBeNull()
  })

  it("rejects cursors with an invalid UUID", () => {
    const value = Buffer.from(
      JSON.stringify({ v: 1, slug: cursor.slug, id: "spot-1" }),
    ).toString("base64url")
    expect(decodeSpotCursor(value)).toBeNull()
  })
})
