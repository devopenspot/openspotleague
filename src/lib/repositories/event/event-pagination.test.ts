import { describe, expect, it } from "vitest";
import { decodeEventCursor, encodeEventCursor } from "./event-pagination";

describe("event pagination cursor", () => {
  const cursor = {
    startAt: "2026-08-14T00:00:00.000Z",
    id: "00000000-0000-0000-0000-000000000001",
  };

  it("round-trips the complete chronological ordering tuple", () => {
    expect(decodeEventCursor(encodeEventCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors", () => {
    expect(decodeEventCursor("not-a-cursor")).toBeNull();
    expect(decodeEventCursor(undefined)).toBeNull();
  });

  it("rejects cursors from an unsupported version", () => {
    const value = Buffer.from(
      JSON.stringify({ v: 2, startAt: cursor.startAt, id: cursor.id }),
    ).toString("base64url");
    expect(decodeEventCursor(value)).toBeNull();
  });

  it("rejects cursors with a non-UUID ordering key", () => {
    const value = Buffer.from(
      JSON.stringify({ v: 1, startAt: cursor.startAt, id: "event-1" }),
    ).toString("base64url");
    expect(decodeEventCursor(value)).toBeNull();
  });
});
