import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const requireCurationAccessMock = vi.fn()
const requireEventCurationAccessMock = vi.fn()
const updateEventMock = vi.fn()
const deleteEventMock = vi.fn()
const findEventByIdMock = vi.fn()
const findEventMediaStateMock = vi.fn()
const uploadEventImageMock = vi.fn()
const uploadEventImageFromUrlMock = vi.fn()
const deleteEventImageMock = vi.fn()

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized"
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
    headers: { "Content-Type": "application/json" },
  })
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: (...args: unknown[]) => requireCurationAccessMock(...args),
  requireEventCurationAccess: (...args: unknown[]) => requireEventCurationAccessMock(...args),
  authorizationErrorResponse,
}))

vi.mock("@/lib/services/event/events", () => ({
  updateEvent: (...args: unknown[]) => updateEventMock(...args),
  deleteEvent: (...args: unknown[]) => deleteEventMock(...args),
  findEventById: (...args: unknown[]) => findEventByIdMock(...args),
  findEventMediaState: (...args: unknown[]) => findEventMediaStateMock(...args),
}))

vi.mock("@/lib/storage", () => ({
  UploadValidationError: class UploadValidationError extends Error {},
  uploadEventImage: (...args: unknown[]) => uploadEventImageMock(...args),
  uploadEventImageFromUrl: (...args: unknown[]) => uploadEventImageFromUrlMock(...args),
  deleteEventImage: (...args: unknown[]) => deleteEventImageMock(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock("@/lib/services/country-scope", () => ({
  resolveScopeCountryCode: async (input: { country?: string }) => {
    if (input.country?.toLowerCase() === "france") return "FR"
    throw Object.assign(new Error("countryCode is required"), { status: 400 })
  },
}))

import { DELETE, PATCH } from "./route"

const fakeContext = (id: string) => ({ params: Promise.resolve({ id }) })

const sampleEvent = {
  id: "event-1",
  slug: "fise-2025",
  name: "FISE 2025",
  url: "https://example.com",
  image: "https://example.com/img.png",
  description: "Festival",
  sports: ["Skateboard"],
  startDate: "2025-07-01",
  endDate: "2025-07-05",
  location: { city: "Montpellier", country: "France" },
  category: "festival" as const,
  categoryName: "Festival",
  featured: false,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
}

function makeJsonRequest(method: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/events/event-1", {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "If-Match": '"2025-01-01T00:00:00.000Z"',
    },
  })
}

function makeMultipartRequest(fields: Record<string, string>, file?: File): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  if (file) form.append("image", file)
  form.append("expectedUpdatedAt", "2025-01-01T00:00:00.000Z")
  return new NextRequest("http://localhost/api/admin/events/event-1", {
    method: "PATCH",
    body: form,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue({ id: "user-1" })
  requireEventCurationAccessMock.mockResolvedValue({ id: "user-1" })
  updateEventMock.mockResolvedValue(sampleEvent)
  deleteEventMock.mockResolvedValue({ imagePath: null })
  findEventByIdMock.mockResolvedValue({ ...sampleEvent, location: { ...sampleEvent.location, countryCode: "FR" } })
  findEventMediaStateMock.mockResolvedValue({ imagePath: null })
  uploadEventImageMock.mockResolvedValue({
    path: "events/event-1/image.jpg",
    url: "https://storage.example.com/event.jpg",
  })
  uploadEventImageFromUrlMock.mockResolvedValue({
    path: "events/event-1/image.jpg",
    url: "https://storage.example.com/event.jpg",
  })
  deleteEventImageMock.mockResolvedValue(undefined)
})

describe("PATCH /api/admin/events/[id]", () => {
  it("returns 200 with the updated event", async () => {
    const res = await PATCH(
      makeJsonRequest("PATCH", { name: "Updated" }),
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleEvent)
    expect(updateEventMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ name: "Updated" }),
      "2025-01-01T00:00:00.000Z",
      "user-1",
    )
  })

  it("preserves multipart event field names and supported clears", async () => {
    const res = await PATCH(
      makeMultipartRequest({
        name: "Updated FISE",
        url: "https://example.com/fise",
        imageUrl: "https://example.com/fise.jpg",
        description: "Updated festival",
        startDate: "2026-07-01",
        endDate: "",
        city: "Montpellier",
        country: "France",
        countryCode: "FR",
        latitude: "43.61",
        longitude: "3.88",
        category: "festival",
        featured: "off",
        instagram: "",
        youtube: "",
        sports: "Skateboard",
      }),
      fakeContext("event-1") as never,
    )

    expect(res.status).toBe(200)
    expect(uploadEventImageFromUrlMock).toHaveBeenCalledWith("https://example.com/fise.jpg", "event-1")
    expect(updateEventMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        image: "https://storage.example.com/event.jpg",
        imagePath: "events/event-1/image.jpg",
        latitude: 43.61,
        longitude: 3.88,
        endDate: null,
        instagram: null,
        youtube: null,
        featured: false,
        sports: ["Skateboard"],
      }),
      "2025-01-01T00:00:00.000Z",
      "user-1",
    )
  })

  it("uploads a replacement file using the shared image field", async () => {
    const file = new File(["image"], "fise.jpg", { type: "image/jpeg" })
    const res = await PATCH(
      makeMultipartRequest(
        {
          name: "Updated FISE",
          url: "https://example.com/fise",
          description: "Updated festival",
          startDate: "2026-07-01",
          city: "Montpellier",
          country: "France",
          latitude: "43.61",
          longitude: "3.88",
          category: "festival",
        },
        file,
      ),
      fakeContext("event-1") as never,
    )

    expect(res.status).toBe(200)
    expect(uploadEventImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "fise.jpg", type: "image/jpeg", size: file.size }),
      "event-1",
    )
    expect(updateEventMock).toHaveBeenCalledWith("event-1", expect.objectContaining({
      image: "https://storage.example.com/event.jpg",
      imagePath: "events/event-1/image.jpg",
    }), "2025-01-01T00:00:00.000Z", "user-1")
  })

  it("cleans the previous event image after a successful replacement", async () => {
    const file = new File(["image"], "fise.jpg", { type: "image/jpeg" })
    findEventMediaStateMock.mockResolvedValue({
      imagePath: "events/event-1/old.jpg",
    })
    findEventByIdMock.mockResolvedValue({
      ...sampleEvent,
      location: { ...sampleEvent.location, countryCode: "FR" },
      imagePath: "events/event-1/old.jpg",
    })
    updateEventMock.mockResolvedValue({
      ...sampleEvent,
      imagePath: "events/event-1/image.jpg",
    })

    await PATCH(
      makeMultipartRequest(
        {
          name: "Updated FISE",
          url: "https://example.com/fise",
          description: "Updated festival",
          startDate: "2026-07-01",
          city: "Montpellier",
          country: "France",
          latitude: "43.61",
          longitude: "3.88",
          category: "festival",
        },
        file,
      ),
      fakeContext("event-1") as never,
    )

    expect(deleteEventImageMock).toHaveBeenCalledWith("events/event-1/old.jpg")
  })

  it("removes a newly uploaded file when the event update fails", async () => {
    const file = new File(["image"], "fise.jpg", { type: "image/jpeg" })
    updateEventMock.mockRejectedValue(new Error("db down"))

    const res = await PATCH(
      makeMultipartRequest(
        {
          name: "Updated FISE",
          url: "https://example.com/fise",
          description: "Updated festival",
          startDate: "2026-07-01",
          city: "Montpellier",
          country: "France",
          latitude: "43.61",
          longitude: "3.88",
          category: "festival",
        },
        file,
      ),
      fakeContext("event-1") as never,
    )

    expect(res.status).toBe(500)
    expect(deleteEventImageMock).toHaveBeenCalledWith("events/event-1/image.jpg")
  })

  it("returns 401 when not signed in", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Not signed in"))
    const res = await PATCH(
      makeJsonRequest("PATCH", { name: "x" }),
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when not admin", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Admin only"))
    const res = await PATCH(
      makeJsonRequest("PATCH", { name: "x" }),
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(403)
  })

  it("returns 200 for empty patch (no-op)", async () => {
    // `SportEventPatchSchema` allows optional fields, so `{}` is a
    // valid no-op patch. We assert the service is still called.
    const res = await PATCH(
      makeJsonRequest("PATCH", {}),
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(200)
    expect(updateEventMock).toHaveBeenCalled()
  })

  it("returns 404 when the event does not exist", async () => {
    updateEventMock.mockRejectedValue(new Error("Sport event not found: x"))
    const res = await PATCH(
      makeJsonRequest("PATCH", { name: "x" }),
      fakeContext("x") as never,
    )
    expect(res.status).toBe(404)
  })
})

describe("DELETE /api/admin/events/[id]", () => {
  it("returns 204", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/events/event-1", {
        method: "DELETE",
        headers: { "If-Match": '"2025-01-01T00:00:00.000Z"' },
      }),
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(204)
    expect(deleteEventMock).toHaveBeenCalledWith(
      "event-1",
      "2025-01-01T00:00:00.000Z",
      "user-1",
    )
  })

  it("returns 401 when not signed in", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Not signed in"))
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/events/event-1", {
        method: "DELETE",
        headers: { "If-Match": '"2025-01-01T00:00:00.000Z"' },
      }),
      fakeContext("event-1") as never,
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when the event does not exist", async () => {
    deleteEventMock.mockRejectedValue(new Error("Sport event not found: x"))
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/events/x", {
        method: "DELETE",
        headers: { "If-Match": '"2025-01-01T00:00:00.000Z"' },
      }),
      fakeContext("x") as never,
    )
    expect(res.status).toBe(404)
  })
})
