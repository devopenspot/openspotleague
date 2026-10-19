import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/config/env", () => ({
  getSupabaseUrl: () => "https://proj.supabase.co",
  getSupabasePublishableKey: () => "sb_publishable_test",
}))

import { getCachedJwks, resetJwksCacheForTests } from "./jwks"

const KEYS = { keys: [{ kid: "k1", kty: "EC" }] }

describe("getCachedJwks", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetJwksCacheForTests()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("fetches once and serves subsequent calls from memory", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(KEYS)))
    const a = await getCachedJwks()
    const b = await getCachedJwks()
    expect(a).toEqual(KEYS)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("dedupes concurrent callers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(KEYS)))
    await Promise.all([getCachedJwks(), getCachedJwks(), getCachedJwks()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("refreshes after the TTL", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(KEYS)))
    await getCachedJwks()
    await getCachedJwks(Date.now() + 11 * 60 * 1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns undefined on failure and backs off retries", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }))
    expect(await getCachedJwks()).toBeUndefined()
    expect(await getCachedJwks()).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
