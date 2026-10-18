import { beforeEach, describe, expect, it, vi } from "vitest"

const fromMock = vi.fn()
const uploadMock = vi.fn()
const removeMock = vi.fn()
const createSignedUrlsMock = vi.fn()
const createSignedUrlMock = vi.fn()
const getPublicUrlMock = vi.fn()
const getSupabaseAdminClientMock = vi.fn()

vi.mock("@/lib/config/env", () => ({
  getSpotImagesBucket: () => "spot-images",
  getEventImagesBucket: () => "event-images",
  getR2AccountId: () => null,
  getR2AccessKeyId: () => null,
  getR2SecretAccessKey: () => null,
  getR2BucketSpots: () => "openspotleague-spots",
  getR2BucketEvents: () => "openspotleague-events",
  getR2PublicDomain: () => null,
  getR2PublicDomainSpots: () => null,
  getR2PublicDomainEvents: () => null,
  getStorageProvider: () => "supabase" as const,
  isR2Configured: () => false,
}))

vi.mock("@/lib/storage/r2", () => ({
  r2Adapter: {
    getPublicUrl: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock("@/lib/storage/config", () => ({
  shouldUseR2: () => false,
  isDualRead: () => false,
  resolveR2Bucket: (k: string) => (k === "spots" ? "openspotleague-spots" : "openspotleague-events"),
  resolveR2Domain: () => null,
  getR2Endpoint: () => null,
}))

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => getSupabaseAdminClientMock(),
}))

vi.mock("sharp", () => {
  const toBufferMock = vi.fn().mockResolvedValue(Buffer.from("webp-bytes"))
  const chain = {
    metadata: vi.fn().mockResolvedValue({ format: "jpeg", width: 100, height: 100 }),
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: toBufferMock,
  }
  const sharpMock = vi.fn(() => chain)
  // Make chain methods return chain for fluent API
  chain.rotate.mockReturnValue(chain)
  chain.resize.mockReturnValue(chain)
  chain.webp.mockReturnValue(chain)
  // metadata needs to be on instance, but sharpMock(input).metadata should work
  // So sharpMock returns chain which has metadata
  return { default: sharpMock }
})

import {
  getEventImageUrls,
  getSpotCardImageUrls,
  getVariantPath,
  uploadEventImage,
  uploadSpotImage,
} from "./storage"

beforeEach(() => {
  // Clear only storage mocks, keep sharp mock intact (vi.resetAllMocks would wipe sharp chain)
  fromMock.mockReset()
  uploadMock.mockReset()
  removeMock.mockReset()
  createSignedUrlsMock.mockReset()
  createSignedUrlMock.mockReset()
  getPublicUrlMock.mockReset()
  getSupabaseAdminClientMock.mockReset()
  fromMock.mockReturnValue({
    upload: uploadMock,
    remove: removeMock,
    createSignedUrls: createSignedUrlsMock,
    createSignedUrl: createSignedUrlMock,
    getPublicUrl: getPublicUrlMock,
  })
  getSupabaseAdminClientMock.mockReturnValue({ storage: { from: fromMock } })
  uploadMock.mockResolvedValue({ error: null })
  removeMock.mockResolvedValue({ error: null })
  createSignedUrlsMock.mockResolvedValue({
    data: [{ path: "events/event-1/image.webp", signedUrl: "signed-event" }],
    error: null,
  })
  createSignedUrlMock.mockResolvedValue({
    data: { signedUrl: "signed-single" },
    error: null,
  })
  getPublicUrlMock.mockImplementation((path: string) => ({
    data: { publicUrl: `https://pub.test/${path}` },
  }))
})

describe("Supabase Storage image helpers", () => {
  it("uploads events to the dedicated event bucket with WebP variants", async () => {
    const file = new File(["image"], "event.jpg", { type: "image/jpeg" })

    const uploaded = await uploadEventImage(file, "event-1")

    expect(fromMock).toHaveBeenCalledWith("event-images")
    // Should upload 4 variants: master + thumb + card + detail
    expect(uploadMock).toHaveBeenCalledTimes(4)
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^events\/event-1\/[^/]+\.webp$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/webp", upsert: false, cacheControl: "public, max-age=31536000, immutable" }),
    )
    expect(uploaded.path).toMatch(/^events\/event-1\/[^/]+\.webp$/)
    expect(uploaded.url).toMatch(/^https:\/\/pub\.test\//)
    expect(uploaded.variantPaths.master).toBe(uploaded.path)
    expect(uploaded.variantPaths.card).toMatch(/_400\.webp$/)
    expect(uploaded.variantPaths.detail).toMatch(/_800\.webp$/)
    expect(uploaded.variantPaths.thumb).toMatch(/_128\.webp$/)
  })

  it("keeps spots in the spot bucket with variants", async () => {
    const file = new File(["image"], "spot.webp", { type: "image/webp" })

    const uploaded = await uploadSpotImage(file, "spot-1")

    expect(fromMock).toHaveBeenCalledWith("spot-images")
    expect(uploadMock).toHaveBeenCalledTimes(4)
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^spots\/spot-1\/[^/]+\.webp$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/webp" }),
    )
    expect(uploaded.path).toMatch(/^spots\/spot-1\/[^/]+\.webp$/)
  })

  it("reads event paths with public URLs from the event bucket", async () => {
    const urls = await getEventImageUrls(["events/event-1/image.webp"])

    expect(fromMock).toHaveBeenCalledWith("event-images")
    expect(getPublicUrlMock).toHaveBeenCalledWith("events/event-1/image.webp")
    expect(urls.get("events/event-1/image.webp")).toBe("https://pub.test/events/event-1/image.webp")
  })

  it("maps variant paths for card variant with fallback to master via public URLs", async () => {
    // Master path for new webp
    const master = "spots/spot-1/uuid.webp"
    const card = "spots/spot-1/uuid_400.webp"
    const urls = await getSpotCardImageUrls([master])

    expect(fromMock).toHaveBeenCalledWith("spot-images")
    expect(getPublicUrlMock).toHaveBeenCalledWith(card)
    expect(urls.get(master)).toBe(`https://pub.test/${card}`)
  })

  it("getVariantPath derives correct suffixes", () => {
    expect(getVariantPath("spots/id/uuid.webp", "card")).toBe("spots/id/uuid_400.webp")
    expect(getVariantPath("spots/id/uuid.webp", "detail")).toBe("spots/id/uuid_800.webp")
    expect(getVariantPath("spots/id/uuid.webp", "thumb")).toBe("spots/id/uuid_128.webp")
    expect(getVariantPath("spots/id/uuid.webp", "master")).toBe("spots/id/uuid.webp")
    // legacy without .webp returns master as-is
    expect(getVariantPath("spots/id/uuid", "card")).toBe("spots/id/uuid")
  })

  it("rejects unsupported or empty uploads before calling Supabase", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" })

    await expect(uploadEventImage(file, "event-1")).rejects.toThrow("Only PNG, JPG, WebP and AVIF images are supported")
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled()
  })
})
