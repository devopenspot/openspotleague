import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  GUEST_NAME_MAX_LENGTH,
  GUEST_TOKEN_MIN_LENGTH,
  GUEST_TOKEN_STORAGE_KEY,
  assertGuestAllowedOnTraining,
  createGuestToken,
  identityActorId,
  identityMatches,
  isGuest,
  isValidGuestToken,
  loadGuestToken,
  loadOrCreateGuestToken,
  normalizeGuestName,
  requireGuestName,
  type Identity,
} from "@/lib/games/guest"
import { GameDomainError } from "@/lib/games/definitions"

const guest: Identity = { userId: null, guestToken: "abc123abc123abc123abc123", name: "Rider" }
const user: Identity = { userId: "user-1", guestToken: null, name: "Sara" }

describe("isValidGuestToken", () => {
  it("accepts base64url tokens of at least 128 bits of entropy", () => {
    expect(isValidGuestToken("a".repeat(GUEST_TOKEN_MIN_LENGTH))).toBe(true)
    expect(isValidGuestToken("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")).toBe(true)
  })

  it("rejects tokens that are too short, too long, or off-charset", () => {
    expect(isValidGuestToken("a".repeat(GUEST_TOKEN_MIN_LENGTH - 1))).toBe(false)
    expect(isValidGuestToken("a".repeat(129))).toBe(false)
    expect(isValidGuestToken("")).toBe(false)
    expect(isValidGuestToken("abc+def")).toBe(false)
    expect(isValidGuestToken("abc/def")).toBe(false)
    expect(isValidGuestToken("abc=def")).toBe(false)
    expect(isValidGuestToken("abc def")).toBe(false)
  })
})

describe("normalizeGuestName", () => {
  it("trims and enforces the 1–30 character range", () => {
    expect(normalizeGuestName("  Rider  ")).toBe("Rider")
    expect(normalizeGuestName("R")).toBe("R")
    expect(normalizeGuestName("r".repeat(GUEST_NAME_MAX_LENGTH))).toBe("r".repeat(GUEST_NAME_MAX_LENGTH))
  })

  it("returns null for empty, oversized, or control-character names", () => {
    expect(normalizeGuestName("")).toBeNull()
    expect(normalizeGuestName("   ")).toBeNull()
    expect(normalizeGuestName("r".repeat(GUEST_NAME_MAX_LENGTH + 1))).toBeNull()
    expect(normalizeGuestName("a\tb")).toBeNull()
    expect(normalizeGuestName("a\nb")).toBeNull()
    expect(normalizeGuestName(`a\u0000b`)).toBeNull()
    expect(normalizeGuestName(`a\u007fb`)).toBeNull()
  })

  it("allows non-ASCII rider names without control characters", () => {
    expect(normalizeGuestName("Manuel")).toBe("Manuel")
    expect(normalizeGuestName("Rider")).toBe("Rider")
  })
})

describe("createGuestToken", () => {
  it("generates unique tokens within the accepted charset and length", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createGuestToken()))
    expect(tokens.size).toBe(50)
    for (const token of tokens) {
      expect(isValidGuestToken(token)).toBe(true)
    }
  })
})

describe("guest token storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it("loads an existing valid token", () => {
    const existing = "validvalidvalidvalidvalid"
    vi.mocked(localStorage.getItem).mockReturnValue(existing)
    expect(loadGuestToken()).toBe(existing)
    expect(loadOrCreateGuestToken()).toBe(existing)
  })

  it("ignores stored tokens that fail validation", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("short")
    expect(loadGuestToken()).toBeNull()
    expect(loadOrCreateGuestToken()).not.toBe("short")
  })

  it("creates and stores a new token when none exists", () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    const token = loadOrCreateGuestToken()
    expect(token).not.toBeNull()
    expect(isValidGuestToken(token ?? "")).toBe(true)
    expect(localStorage.setItem).toHaveBeenCalledWith(GUEST_TOKEN_STORAGE_KEY, token)
  })

  it("returns null when storage is unavailable", () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("Quota exceeded")
    })
    expect(loadOrCreateGuestToken()).toBeNull()
  })
})

describe("identity helpers", () => {
  it("distinguishes guests from signed-in users", () => {
    expect(isGuest(guest)).toBe(true)
    expect(isGuest(user)).toBe(false)
  })

  it("resolves the actor id from token or userId", () => {
    expect(identityActorId(guest)).toBe(guest.guestToken)
    expect(identityActorId(user)).toBe(user.userId)
    expect(() => identityActorId({ userId: null, guestToken: null, name: "" })).toThrow(GameDomainError)
  })

  it("matches players by userId for signed-in actors", () => {
    expect(identityMatches(user, { userId: "user-1", guestToken: null })).toBe(true)
    expect(identityMatches(user, { userId: "user-2", guestToken: null })).toBe(false)
  })

  it("matches players by guestToken for guest actors", () => {
    expect(identityMatches(guest, { userId: null, guestToken: guest.guestToken })).toBe(true)
    expect(identityMatches(guest, { userId: null, guestToken: "other" })).toBe(false)
    expect(identityMatches(guest, { userId: "user-1", guestToken: null })).toBe(false)
  })

  it("forbids guest identity outside training games", () => {
    expect(() => assertGuestAllowedOnTraining("challenge", true)).toThrow(GameDomainError)
    expect(() => assertGuestAllowedOnTraining("training", true)).not.toThrow()
    expect(() => assertGuestAllowedOnTraining("challenge", false)).not.toThrow()
    expect(() => assertGuestAllowedOnTraining("training", false)).not.toThrow()
  })
})

describe("requireGuestName", () => {
  it("requires a display name from guests", () => {
    expect(() => requireGuestName(guest)).not.toThrow()
    expect(() => requireGuestName({ userId: null, guestToken: "abc123abc123abc123abc123", name: "" })).toThrow(GameDomainError)
  })

  it("never requires a name from signed-in users", () => {
    expect(() => requireGuestName({ userId: "user-1", guestToken: null, name: "" })).not.toThrow()
  })
})
