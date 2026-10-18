import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const requireCurationAccessMock = vi.fn()
const requireEventCurationAccessMock = vi.fn()
const createEventMock = vi.fn()
const updateEventMock = vi.fn()
const deleteEventMock = vi.fn()
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
  createEvent: (...args: unknown[]) => createEventMock(...args),
  updateEvent: (...args: unknown[]) => updateEventMock(...args),
  deleteEvent: (...args: unknown[]) => deleteEventMock(...args),
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

import { POST } from "./route"

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

function makeFormRequest(fields: Record<string, string>, file?: File): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  if (file) form.append("image", file)
  return new NextRequest("http://localhost/api/admin/events", {
    method: "POST",
    body: form,
  })
}

function makeMultipartRequest(fields: Record<string, string>, file?: File): NextRequest {
  return makeFormRequest(fields, file)
}

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/events", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const validFields = {
  name: "FISE 2025",
  url: "https://example.com",
  imageUrl: "https://example.com/img.png",
  description: "Festival",
  sports: "Skateboard",
  startDate: "2025-07-01",
  endDate: "2025-07-05",
  city: "Montpellier",
  country: "France",
  countryCode: "FR",
  category: "festival",
  latitude: "43.61",
  longitude: "3.88",
}

const validBody = {
  name: "FISE 2025",
  url: "https://example.com",
  image: "https://example.com/img.png",
  description: "Festival",
  sports: ["Skateboard"],
  startDate: "2025-07-01",
  endDate: "2025-07-05",
  city: "Montpellier",
  country: "France",
  countryCode: "FR",
  category: "festival" as const,
  featured: false,
}

beforeEach(() => {
  vi.resetAllMocks()
  requireCurationAccessMock.mockResolvedValue({ id: "user-1" })
  requireEventCurationAccessMock.mockResolvedValue({ id: "user-1" })
  createEventMock.mockResolvedValue(sampleEvent)
  updateEventMock.mockResolvedValue(sampleEvent)
  deleteEventMock.mockResolvedValue({ imagePath: null })
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

describe("POST /api/admin/events", () => {
  it("returns 201 with the created event", async () => {
    const res = await POST(makeFormRequest(validFields))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(sampleEvent)
    expect(createEventMock).toHaveBeenCalled()
  })

  it("accepts multipart events with an external image URL", async () => {
    const res = await POST(
      makeMultipartRequest({
        name: "FISE 2026",
        url: "https://example.com/fise",
        imageUrl: "https://example.com/fise.jpg",
        description: "Festival",
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        city: "Montpellier",
        country: "France",
        countryCode: "FR",
        latitude: "43.61",
        longitude: "3.88",
        category: "festival",
      }),
    )

    expect(res.status).toBe(201)
    expect(uploadEventImageFromUrlMock).toHaveBeenCalledWith("https://example.com/fise.jpg", expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(createEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "https://storage.example.com/event.jpg",
        imagePath: "events/event-1/image.jpg",
        latitude: 43.61,
        longitude: 3.88,
      }),
    )
  })

  it("uploads a file using the shared image field and event bucket service", async () => {
    const file = new File(["image"], "fise.jpg", { type: "image/jpeg" })
    const res = await POST(
      makeMultipartRequest(
        {
          name: "FISE 2026",
          url: "https://example.com/fise",
          description: "Festival",
          startDate: "2026-07-01",
          endDate: "2026-07-05",
          city: "Montpellier",
          country: "France",
          countryCode: "FR",
          latitude: "43.61",
          longitude: "3.88",
          category: "festival",
        },
        file,
      ),
    )

    expect(res.status).toBe(201)
    expect(uploadEventImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "fise.jpg", type: "image/jpeg", size: file.size }),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    const pendingId = uploadEventImageMock.mock.calls[0]?.[1] as string
    expect(createEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pendingId,
        image: "https://storage.example.com/event.jpg",
        imagePath: "events/event-1/image.jpg",
      }),
    )
    expect(updateEventMock).not.toHaveBeenCalled()
  })

  it("removes the created event when its image upload fails", async () => {
    const file = new File(["image"], "fise.jpg", { type: "image/jpeg" })
    uploadEventImageMock.mockRejectedValue(new Error("Bucket not found"))

    const res = await POST(
      makeMultipartRequest(
        {
          name: "FISE 2026",
          url: "https://example.com/fise",
          description: "Festival",
          startDate: "2026-07-01",
          city: "Montpellier",
          country: "France",
          countryCode: "FR",
          latitude: "43.61",
          longitude: "3.88",
          category: "festival",
        },
        file,
      ),
    )

    expect(res.status).toBe(502)
    expect(createEventMock).not.toHaveBeenCalled()
    expect(deleteEventMock).not.toHaveBeenCalled()
    expect(deleteEventImageMock).not.toHaveBeenCalled()
  })

  it("returns 401 when not signed in", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Not signed in"))
    const res = await POST(makeJsonRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not admin", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Admin only"))
    const res = await POST(makeJsonRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("returns 400 for invalid body (not multipart)", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/events", {
        method: "POST",
        body: "plain text",
      }),
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeFormRequest({ name: "x" }))
    expect(res.status).toBe(400)
  })

  it("returns 500 when the service throws", async () => {
    createEventMock.mockRejectedValue(new Error("db down"))
    const res = await POST(makeFormRequest(validFields))
    expect(res.status).toBe(500)
  })
})
