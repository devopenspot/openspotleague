import { describe, expect, it } from "vitest"
import {
  decodeAdminUserCursor,
  encodeAdminUserCursor,
} from "./admin-user-pagination"

describe("admin user cursors", () => {
  it("round trips a stable cursor", () => {
    const cursor = {
      sortKey: "alice@example.com",
      id: "00000000-0000-0000-0000-000000000001",
    }

    expect(decodeAdminUserCursor(encodeAdminUserCursor(cursor))).toEqual(cursor)
  })

  it("rejects malformed and non-UUID cursors", () => {
    expect(decodeAdminUserCursor("not-a-cursor")).toBeNull()
    expect(
      decodeAdminUserCursor(
        encodeAdminUserCursor({ sortKey: "alice", id: "user-1" }),
      ),
    ).toBeNull()
  })
})
