import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { adminRequest, getAdminErrorMessage } from "./request"

describe("adminRequest", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("returns body on success", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ id: "1", name: "Region" }),
        headers: new Headers(),
      }) as Response,
    )

    const body = await adminRequest("/api/admin/regions", { method: "POST" })
    expect(body).toEqual({ id: "1", name: "Region" })
  })

  it("throws with server error message", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: false,
        status: 409,
        json: async () => ({ error: "Region slug already exists" }),
        headers: new Headers(),
      }) as Response,
    )

    await expect(adminRequest("/api/admin/regions", {})).rejects.toThrow("Region slug already exists")
  })

  it("throws HTTP status when body has no error", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({}),
        headers: new Headers(),
      }) as Response,
    )

    await expect(adminRequest("/api/admin/regions", {})).rejects.toThrow("HTTP 500")
  })

  it("calls onResponse before parsing", async () => {
    const onResponse = vi.fn()
    const headers = new Headers({ etag: '"2026-01-01T00:00:00.000Z"' })
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ ok: true }),
        headers,
      }) as Response,
    )

    await adminRequest("/api/admin/trick-catalogs/skateboard/tricks/boardslide", { method: "PUT" }, onResponse)
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ headers }))
    expect(onResponse.mock.calls[0]?.[0].headers.get("etag")).toBe('"2026-01-01T00:00:00.000Z"')
  })

  it("wraps AbortError as timeout", async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error("The operation was aborted")
      err.name = "AbortError"
      throw err
    })

    await expect(adminRequest("/api/admin/regions", {})).rejects.toThrow("Request timed out — please try again")

    try {
      await adminRequest("/api/admin/regions", {})
    } catch (e) {
      expect((e as Error & { cause?: unknown }).cause).toMatchObject({ name: "AbortError" })
    }
  })

  it("clears timeout on success and failure", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout")
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      }) as Response,
    )
    await adminRequest("/api/admin/regions", {})
    expect(clearSpy).toHaveBeenCalled()

    clearSpy.mockClear()
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down")
    })
    await expect(adminRequest("/api/admin/regions", {})).rejects.toThrow("network down")
    expect(clearSpy).toHaveBeenCalled()
  })
})

describe("getAdminErrorMessage", () => {
  it("returns error.message for Error", () => {
    expect(getAdminErrorMessage(new Error("boom"), "fallback")).toBe("boom")
  })
  it("returns fallback for non-Error", () => {
    expect(getAdminErrorMessage("string", "fallback")).toBe("fallback")
    expect(getAdminErrorMessage(null, "fallback")).toBe("fallback")
  })
})
