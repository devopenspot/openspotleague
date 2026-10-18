import { createCursorCodec } from "../core/pagination"

export interface SpotListCursor {
  slug: string
  id: string
}

export interface RandomSpotCursor {
  seed: string
  index: number
}

const codec = createCursorCodec<SpotListCursor>()
const randomCodec = createCursorCodec<RandomSpotCursor>()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeSpotCursor(cursor: SpotListCursor): string {
  return codec.encode(cursor)
}

export function decodeSpotCursor(value: string | undefined): SpotListCursor | null {
  if (!value) return null
  const decoded = codec.decode(value)
  if (!decoded) return null
  if (typeof decoded.slug !== "string" || decoded.slug.length === 0) return null
  if (typeof decoded.id !== "string" || !UUID_PATTERN.test(decoded.id)) return null
  return decoded
}

export function encodeRandomSpotCursor(cursor: RandomSpotCursor): string {
  return randomCodec.encode(cursor)
}

export function decodeRandomSpotCursor(value: string | undefined): RandomSpotCursor | null {
  if (!value) return null
  const decoded = randomCodec.decode(value)
  if (!decoded) return null
  if (typeof decoded.seed !== "string" || !UUID_PATTERN.test(decoded.seed)) return null
  if (typeof decoded.index !== "number" || !Number.isInteger(decoded.index) || decoded.index < 0) return null
  return decoded
}
