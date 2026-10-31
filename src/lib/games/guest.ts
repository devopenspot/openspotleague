import { GameDomainError } from "@/lib/games/definitions"

/**
 * Guest identity contract (spec section 13.1):
 * - A guest token is generated client-side with at least 128 bits of entropy.
 * - It is stored in local storage and sent in `x-guest-token`.
 * - A guest name is sent in `x-guest-name` on guest create and first join.
 * - Guest tokens MUST NOT appear in API state, URLs, realtime payloads, or
 *   logs.
 */

export const GUEST_TOKEN_HEADER = "x-guest-token"
export const GUEST_NAME_HEADER = "x-guest-name"
export const GUEST_TOKEN_STORAGE_KEY = "openspot-guest-token"

export const GUEST_TOKEN_MIN_LENGTH = 22
export const GUEST_NAME_MIN_LENGTH = 1
export const GUEST_NAME_MAX_LENGTH = 30

const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/
const CONTROL_CHARACTER_PATTERN = /[\p{Cc}]/u

export function isValidGuestToken(value: string): boolean {
  return (
    value.length >= GUEST_TOKEN_MIN_LENGTH &&
    value.length <= 128 &&
    GUEST_TOKEN_PATTERN.test(value)
  )
}

export function normalizeGuestName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < GUEST_NAME_MIN_LENGTH || trimmed.length > GUEST_NAME_MAX_LENGTH) {
    return null
  }
  if (CONTROL_CHARACTER_PATTERN.test(trimmed)) return null
  return trimmed
}

/**
 * A ready-made name so a guest can join in one tap. It stays editable and is
 * a display name only: identity comes from the guest token.
 */
export function generateGuestName(): string {
  const [value = 0] = crypto.getRandomValues(new Uint16Array(1))
  return `Rider ${1000 + (value % 9000)}`
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function createGuestToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return base64urlFromBytes(bytes)
}

export function loadGuestToken(): string | null {
  if (typeof localStorage === "undefined") return null
  const existing = localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)
  return existing && isValidGuestToken(existing) ? existing : null
}

export function loadOrCreateGuestToken(): string | null {
  const existing = loadGuestToken()
  if (existing) return existing
  const next = createGuestToken()
  try {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, next)
  } catch {
    return null
  }
  return next
}

/**
 * The minimal identity claims used to match an actor against a player.
 * Authenticated users carry a `userId`; anonymous guests carry a
 * `guestToken`. Both are never present at the same time (the server rejects
 * conflicting claims).
 */
export type ActorIdentity = {
  userId: string | null
  guestToken: string | null
}

/**
 * The normalized actor identity for game service calls. Adds the display
 * name snapshot used when creating or joining a game.
 */
export type Identity = ActorIdentity & {
  name: string
}

export function isGuest(identity: Identity): boolean {
  return identity.userId === null
}

export function identityActorId(identity: Identity): string {
  const actor = identity.guestToken ?? identity.userId
  if (!actor) throw new GameDomainError("NOT_AUTHORIZED", "An actor identity is required")
  return actor
}

export function identityMatches(identity: ActorIdentity, player: { userId: string | null; guestToken: string | null }): boolean {
  if (identity.userId) return player.userId === identity.userId
  return Boolean(identity.guestToken) && player.guestToken === identity.guestToken
}

/**
 * A guest token is scoped to one device identity and cannot change after that
 * identity joins a game. The token must not be sent back to the client in
 * state projections.
 */
export function assertGuestAllowedOnTraining(mode: string, guest: boolean) {
  if (guest && mode !== "training") {
    throw new GameDomainError("NOT_AUTHORIZED", "Guest identity is only allowed in training games")
  }
}

/**
 * Guests must present a display name when they create or join a game, because
 * the name is snapshotted into `game_players.display_name` at that moment.
 */
export function requireGuestName(identity: Identity) {
  if (isGuest(identity) && !identity.name) {
    throw new GameDomainError("INVALID_INPUT", "A guest rider name is required")
  }
}
