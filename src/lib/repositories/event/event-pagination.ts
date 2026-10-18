import { createCursorCodec } from "../core/pagination"

export interface EventListCursor {
  startAt: string;
  id: string;
}

/**
 * Encode the complete ordering tuple so pagination remains stable when two
 * events share the same calendar start date.
 */
const codec = createCursorCodec<EventListCursor>()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeEventCursor(cursor: EventListCursor): string {
  return codec.encode(cursor)
}

export function decodeEventCursor(value: string | undefined): EventListCursor | null {
  if (!value) return null
  const decoded = codec.decode(value)
  if (!decoded) return null
  if (typeof decoded.startAt !== "string" || !Number.isFinite(Date.parse(decoded.startAt))) return null
  if (typeof decoded.id !== "string" || !UUID_PATTERN.test(decoded.id)) return null
  return decoded
}
