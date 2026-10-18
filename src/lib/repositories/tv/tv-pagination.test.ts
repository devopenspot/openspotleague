import { describe, expect, it } from "vitest"
import { decodeTvPageCursor, encodeTvPageCursor } from "./tv-pagination"

const CURSOR = {
  sortOrder: 3,
  postDate: "2026-01-15T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "11111111-1111-1111-1111-111111111111",
}

describe("tv page cursor", () => {
  it("round-trips a valid cursor", () => {
    expect(decodeTvPageCursor(encodeTvPageCursor(CURSOR))).toEqual(CURSOR)
  })

  it("rejects missing, corrupt, and tampered cursors", () => {
    expect(decodeTvPageCursor(undefined)).toBeNull()
    expect(decodeTvPageCursor("not-a-cursor")).toBeNull()
    const signed = encodeTvPageCursor(CURSOR)
    expect(decodeTvPageCursor(`${signed}tampered`)).toBeNull()
  })

  it("rejects structurally invalid payloads", () => {
    expect(
      decodeTvPageCursor(encodeTvPageCursor({ ...CURSOR, sortOrder: -1 })),
    ).toBeNull()
    expect(
      decodeTvPageCursor(encodeTvPageCursor({ ...CURSOR, id: "not-a-uuid" })),
    ).toBeNull()
    expect(
      decodeTvPageCursor(encodeTvPageCursor({ ...CURSOR, postDate: "yesterday" })),
    ).toBeNull()
  })
})
