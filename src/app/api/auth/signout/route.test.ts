import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const signOutMock = vi.fn()
const configNotReadyResponseMock = vi.fn(() =>
  new Response(JSON.stringify({ error: "Auth is not configured" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  }),
)

vi.mock("@/lib/auth/server", () => {
  class AuthConfigError extends Error {
    constructor() {
      super("Auth is not configured")
      this.name = "AuthConfigError"
    }
  }
  return {
    signOut: (...args: unknown[]) => signOutMock(...args),
    AuthConfigError,
    configNotReadyResponse: () => configNotReadyResponseMock(),
  }
})

import { POST } from "./route"
import { AuthConfigError } from "@/lib/auth/server"

function makeRequest(origin: string | null, url = "https://openspot.test/api/auth/signout") {
  // `Origin` is a forbidden header name in the Web Fetch spec — passing it
  // through `RequestInit.headers` is silently dropped. Set it on the
  // NextRequest instance after construction instead.
  const request = new NextRequest(url, { method: "POST" })
  if (origin) request.headers.set("origin", origin)
  return request
}

describe("POST /api/auth/signout", () => {
  beforeEach(() => {
    signOutMock.mockReset()
    signOutMock.mockResolvedValue({ error: null })
    configNotReadyResponseMock.mockClear()
  })

  it("rejects requests without an Origin header (CSRF)", async () => {
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(403)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("rejects requests whose Origin does not match the request URL", async () => {
    const res = await POST(makeRequest("https://evil.example.com"))
    expect(res.status).toBe(403)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("accepts same-origin requests and returns ok", async () => {
    const res = await POST(makeRequest("https://openspot.test"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok?: boolean }
    expect(body.ok).toBe(true)
    expect(signOutMock).toHaveBeenCalledOnce()
  })

  it("returns the upstream error from signOut", async () => {
    signOutMock.mockResolvedValueOnce({ error: "boom" })
    const res = await POST(makeRequest("https://openspot.test"))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe("boom")
  })

  it("returns 503 when auth is not configured", async () => {
    signOutMock.mockRejectedValueOnce(new AuthConfigError())
    const res = await POST(makeRequest("https://openspot.test"))
    expect(res.status).toBe(503)
    expect(configNotReadyResponseMock).toHaveBeenCalled()
  })
})
