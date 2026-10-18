import { createCursorCodec } from "../core/pagination"

/**
 * Keyset cursor for TV card pagination. Order is
 * `(sortOrder ASC, postDate DESC, createdAt DESC, id DESC)` — `id`
 * breaks full ties so pages are stable under concurrent publishes.
 */
export interface TvPageCursor {
  sortOrder: number
  postDate: string
  createdAt: string
  id: string
}

const codec = createCursorCodec<TvPageCursor>()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeTvPageCursor(cursor: TvPageCursor): string {
  return codec.encode(cursor)
}

export function decodeTvPageCursor(value: string | undefined): TvPageCursor | null {
  if (!value) return null
  const decoded = codec.decode(value)
  if (!decoded) return null
  if (
    typeof decoded.sortOrder !== "number" ||
    !Number.isInteger(decoded.sortOrder) ||
    decoded.sortOrder < 0
  )
    return null
  if (typeof decoded.postDate !== "string" || Number.isNaN(Date.parse(decoded.postDate))) return null
  if (typeof decoded.createdAt !== "string" || Number.isNaN(Date.parse(decoded.createdAt))) return null
  if (typeof decoded.id !== "string" || !UUID_PATTERN.test(decoded.id)) return null
  return decoded
}
