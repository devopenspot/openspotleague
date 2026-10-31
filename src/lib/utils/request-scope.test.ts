import { describe, expect, it } from "vitest"
import {
  getRequestAssets,
  isRequestScoped,
  perRequest,
  runInRequestScope,
  type AssetFetcher,
} from "./request-scope"

const assets: AssetFetcher = { fetch: async () => new Response() }

describe("perRequest", () => {
  it("shares one instance outside a request scope", () => {
    const get = perRequest(() => ({}))
    expect(isRequestScoped()).toBe(false)
    expect(get()).toBe(get())
  })

  it("gives each request scope its own stable instance", () => {
    const get = perRequest(() => ({}))
    const first = runInRequestScope(assets, () => {
      expect(get()).toBe(get())
      return get()
    })
    const second = runInRequestScope(assets, get)
    expect(first).not.toBe(second)
    expect(first).not.toBe(get())
  })

  it("keeps the scope across async boundaries", async () => {
    const seen = await runInRequestScope(assets, async () => {
      await Promise.resolve()
      return getRequestAssets()
    })
    expect(seen).toBe(assets)
    expect(getRequestAssets()).toBeUndefined()
  })
})
