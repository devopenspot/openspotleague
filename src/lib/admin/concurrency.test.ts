import { describe, expect, it } from "vitest"
import { getExpectedUpdatedAt, setUpdatedAtHeaders } from "./concurrency"

describe("admin optimistic concurrency", () => {
  it("normalizes an If-Match ETag", () => {
    const request = new Request("http://localhost", {
      headers: { "If-Match": 'W/"2026-08-17T12:00:00.000Z"' },
    })
    expect(getExpectedUpdatedAt(request)).toBe("2026-08-17T12:00:00.000Z")
  })

  it("uses a form token when the request has no ETag", () => {
    const form = new FormData()
    form.set("expectedUpdatedAt", "2026-08-17T12:00:00.000Z")
    expect(getExpectedUpdatedAt(new Request("http://localhost"), form)).toBe(
      "2026-08-17T12:00:00.000Z",
    )
  })

  it("returns an ETag and Last-Modified value after a committed write", () => {
    const response = setUpdatedAtHeaders(
      new Response(null),
      "2026-08-17T12:00:00.000Z",
    )
    expect(response.headers.get("etag")).toBe('"2026-08-17T12:00:00.000Z"')
    expect(response.headers.get("last-modified")).toBe(
      "Mon, 17 Aug 2026 12:00:00 GMT",
    )
  })
})
