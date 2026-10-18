const CURSOR_VERSION = 1
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AdminUserCursor {
  sortKey: string
  id: string
}

export function encodeAdminUserCursor(cursor: AdminUserCursor): string {
  return Buffer.from(
    JSON.stringify({
      v: CURSOR_VERSION,
      sortKey: cursor.sortKey,
      id: cursor.id,
    }),
  ).toString("base64url")
}

export function decodeAdminUserCursor(
  value: string | undefined,
): AdminUserCursor | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    )
    if (!parsed || typeof parsed !== "object") return null

    const candidate = parsed as Record<string, unknown>
    if (
      candidate.v !== CURSOR_VERSION ||
      typeof candidate.sortKey !== "string" ||
      candidate.sortKey.length === 0 ||
      typeof candidate.id !== "string" ||
      !UUID_PATTERN.test(candidate.id)
    ) {
      return null
    }

    return { sortKey: candidate.sortKey, id: candidate.id }
  } catch {
    return null
  }
}
