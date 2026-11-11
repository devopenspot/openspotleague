import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { GameDomainError } from "@/lib/games/definitions"
import {
  GUEST_NAME_HEADER,
  GUEST_TOKEN_HEADER,
} from "@/lib/games/guest"

const getSessionUserMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: getSessionUserMock,
}))

import { TimeoutError } from "@/lib/db/client"
import {
  gameErrorResponse,
  identityErrorResponse,
  resolveAuthenticatedIdentity,
  resolveIdentity,
} from "./identity"

const VALID_TOKEN = "guesttoken0123456789ab"

function requestWith(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest
}

function signedInUser() {
  getSessionUserMock.mockResolvedValue({ id: "user-1", name: "Sara" })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resolveIdentity", () => {
  it("resolves a signed-in session to a user identity", async () => {
    signedInUser()
    const identity = await resolveIdentity(requestWith({}))
    expect(identity).toEqual({ userId: "user-1", guestToken: null, name: "Sara" })
  })

  it("resolves guest headers to a guest identity", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const identity = await resolveIdentity(
      requestWith({
        [GUEST_TOKEN_HEADER]: VALID_TOKEN,
        [GUEST_NAME_HEADER]: "  Rider  ",
      }),
    )
    expect(identity).toEqual({ userId: null, guestToken: VALID_TOKEN, name: "Rider" })
  })

  it("accepts a guest token without a name", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const identity = await resolveIdentity(
      requestWith({ [GUEST_TOKEN_HEADER]: VALID_TOKEN }),
    )
    expect(identity.name).toBe("")
  })

  it("rejects conflicting session and guest identity claims", async () => {
    signedInUser()
    await expect(
      resolveIdentity(requestWith({ [GUEST_TOKEN_HEADER]: VALID_TOKEN })),
    ).rejects.toThrow(GameDomainError)
  })

  it("rejects an invalid guest token", async () => {
    getSessionUserMock.mockResolvedValue(null)
    await expect(
      resolveIdentity(requestWith({ [GUEST_TOKEN_HEADER]: "short" })),
    ).rejects.toThrow(GameDomainError)
  })

  it("rejects an invalid guest name", async () => {
    getSessionUserMock.mockResolvedValue(null)
    await expect(
      resolveIdentity(
        requestWith({
          [GUEST_TOKEN_HEADER]: VALID_TOKEN,
          [GUEST_NAME_HEADER]: "\t",
        }),
      ),
    ).rejects.toThrow(GameDomainError)
  })

  it("allows anonymous callers only when allowAnonymous is set", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const anonymous = await resolveIdentity(requestWith({}), { allowAnonymous: true })
    expect(anonymous).toEqual({ userId: null, guestToken: null, name: "" })

    await expect(resolveIdentity(requestWith({}))).rejects.toThrow(GameDomainError)
  })
})

describe("resolveAuthenticatedIdentity", () => {
  it("accepts a session or guest identity", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const guestIdentity = await resolveAuthenticatedIdentity(
      requestWith({ [GUEST_TOKEN_HEADER]: VALID_TOKEN }),
    )
    expect(guestIdentity.guestToken).toBe(VALID_TOKEN)
  })

  it("rejects a fully anonymous caller", async () => {
    getSessionUserMock.mockResolvedValue(null)
    await expect(
      resolveAuthenticatedIdentity(requestWith({})),
    ).rejects.toThrow(GameDomainError)
  })
})

describe("identityErrorResponse", () => {
  it("maps domain errors to their status codes", () => {
    const invalid = new GameDomainError("INVALID_INPUT", "bad")
    const unauthorized = new GameDomainError("NOT_AUTHORIZED", "nope")
    const limited = new GameDomainError("RATE_LIMITED", "slow down")
    const unauthenticated = new GameDomainError("NOT_AUTHORIZED", "Authentication required")
    expect(identityErrorResponse(invalid).status).toBe(400)
    expect(identityErrorResponse(unauthorized).status).toBe(403)
    expect(identityErrorResponse(limited).status).toBe(429)
    expect(identityErrorResponse(unauthenticated).status).toBe(401)
  })

  it("maps unknown errors to 500", () => {
    expect(identityErrorResponse(new Error("boom")).status).toBe(500)
  })
})

describe("gameErrorResponse", () => {
  it("maps DB timeouts and connection errors to 503 without the internal-error hook", async () => {
    const onInternalError = vi.fn()

    const timeout = gameErrorResponse(new TimeoutError(15_000), onInternalError)
    const connection = gameErrorResponse(new Error("ECONNRESET"), onInternalError)

    expect(timeout.status).toBe(503)
    expect(connection.status).toBe(503)
    expect(await timeout.json()).toEqual({
      error: "The games service is temporarily unavailable",
      code: "SERVICE_UNAVAILABLE",
    })
    expect(onInternalError).not.toHaveBeenCalled()
  })

  it("keeps unknown errors as a generic 500", async () => {
    const onInternalError = vi.fn()
    const response = gameErrorResponse(new Error("boom"), onInternalError)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Internal error" })
    expect(onInternalError).toHaveBeenCalledTimes(1)
  })
})
