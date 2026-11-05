/**
 * Contest cover route — services and storage mocked. Covers the guard order
 * (auth → validation → organizer check → upload → versioned write) and the
 * best-effort storage cleanup for replaced, replayed and failed uploads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getSessionUserMock = vi.hoisted(() => vi.fn())
const mocks = vi.hoisted(() => ({
  assertCanEditContest: vi.fn(),
  setContestCover: vi.fn(),
  uploadEventImage: vi.fn(),
  deleteEventImage: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUserMock(...args),
}))
vi.mock("@/lib/services/league", () => ({
  assertCanEditContest: mocks.assertCanEditContest,
  setContestCover: mocks.setContestCover,
}))
vi.mock("@/lib/storage", async () => {
  const { UploadValidationError } = await import("@/lib/storage/errors")
  return {
    UploadValidationError,
    uploadEventImage: mocks.uploadEventImage,
    deleteEventImage: mocks.deleteEventImage,
  }
})
vi.mock("@/app/api/league/rate-limit", () => ({
  enforceLeagueRateLimit: vi.fn(),
}))

import { LeagueDomainError } from "@/lib/league/definitions"
import { UploadValidationError } from "@/lib/storage/errors"
import { DELETE, POST } from "./route"

const USER = { id: "user-1", email: "organizer@example.com" }
const KEY = "8b1f0b1e-9c0d-4a5e-b2f3-aabbccddeeff"
const context = { params: Promise.resolve({ id: "e1" }) }

function coverRequest(fields: Record<string, string | File>): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new NextRequest("http://localhost/api/league/events/e1/cover", {
    method: "POST",
    body: form,
  })
}

function image(): File {
  return new File([new Uint8Array([1, 2, 3])], "cover.jpg", {
    type: "image/jpeg",
  })
}

beforeEach(() => {
  getSessionUserMock.mockReset().mockResolvedValue(USER)
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.assertCanEditContest.mockResolvedValue(undefined)
  mocks.deleteEventImage.mockResolvedValue(undefined)
  mocks.uploadEventImage.mockResolvedValue({
    path: "events/e1/new.webp",
    url: "events/e1/new.webp",
    variantPaths: {},
  })
})

describe("POST cover", () => {
  it("requires a session", async () => {
    getSessionUserMock.mockResolvedValue(null)
    const response = await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(response.status).toBe(401)
    expect(mocks.uploadEventImage).not.toHaveBeenCalled()
  })

  it("rejects a missing file or bad mutation fields before uploading", async () => {
    const noFile = await POST(
      coverRequest({ expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(noFile.status).toBe(400)
    const badKey = await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: "nope" }),
      context,
    )
    expect(badKey.status).toBe(400)
    expect(mocks.uploadEventImage).not.toHaveBeenCalled()
  })

  it("never uploads for callers who cannot edit the contest", async () => {
    mocks.assertCanEditContest.mockRejectedValue(
      new LeagueDomainError("NOT_AUTHORIZED", "nope"),
    )
    const response = await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(response.status).toBe(403)
    expect(mocks.uploadEventImage).not.toHaveBeenCalled()
  })

  it("stores the cover, bumps the version and removes the replaced file", async () => {
    mocks.setContestCover.mockResolvedValue({
      id: "e1",
      version: 4,
      previousImageUrl: "events/e1/old.webp",
      replayed: false,
    })
    const response = await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "e1", version: 4 })
    expect(mocks.setContestCover).toHaveBeenCalledWith(USER.id, {
      eventId: "e1",
      expectedVersion: 3,
      idempotencyKey: KEY,
      imageUrl: "events/e1/new.webp",
    })
    expect(mocks.deleteEventImage).toHaveBeenCalledWith("events/e1/old.webp")
  })

  it("discards the fresh upload when the key replays an earlier call", async () => {
    mocks.setContestCover.mockResolvedValue({
      id: "e1",
      version: 4,
      previousImageUrl: null,
      replayed: true,
    })
    await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(mocks.deleteEventImage).toHaveBeenCalledWith("events/e1/new.webp")
  })

  it("cleans up the upload when the versioned write fails", async () => {
    mocks.setContestCover.mockRejectedValue(
      new LeagueDomainError("STALE_VERSION", "changed"),
    )
    const response = await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(response.status).toBe(409)
    expect(mocks.deleteEventImage).toHaveBeenCalledWith("events/e1/new.webp")
  })

  it("maps upload validation errors to 400", async () => {
    mocks.uploadEventImage.mockRejectedValue(
      new UploadValidationError("Images must be between 1 byte and 5 MB"),
    )
    const response = await POST(
      coverRequest({ image: image(), expectedVersion: "3", idempotencyKey: KEY }),
      context,
    )
    expect(response.status).toBe(400)
    expect(mocks.setContestCover).not.toHaveBeenCalled()
  })
})

describe("DELETE cover", () => {
  it("falls back to the designed cover and removes the stored file", async () => {
    mocks.setContestCover.mockResolvedValue({
      id: "e1",
      version: 5,
      previousImageUrl: "events/e1/old.webp",
      replayed: false,
    })
    const response = await DELETE(
      new NextRequest("http://localhost/api/league/events/e1/cover", {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: 4, idempotencyKey: KEY }),
        headers: { "Content-Type": "application/json" },
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(mocks.setContestCover).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ imageUrl: null, expectedVersion: 4 }),
    )
    expect(mocks.deleteEventImage).toHaveBeenCalledWith("events/e1/old.webp")
  })
})
