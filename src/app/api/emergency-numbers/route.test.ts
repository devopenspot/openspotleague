import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const getEmergencyNumbersMock = vi.fn()

vi.mock("@/lib/emergency", () => ({
	getEmergencyNumbers: (...args: unknown[]) => getEmergencyNumbersMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
	log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"
import { fetchEmergencyNumbers } from "@/lib/emergency/fetchers"

const sample = {
	country: { name: "Colombia", iso2: "CO" },
	primary: { number: "123", service: "dispatch" as const },
	all: {
		police: ["112"],
		ambulance: ["125"],
		fire: ["119"],
		dispatch: ["123"],
		member112: false,
	},
}

function makeRequest(query: string): NextRequest {
	return new NextRequest(`http://localhost/api/emergency-numbers${query}`)
}

beforeEach(() => {
	vi.resetAllMocks()
})

describe("GET /api/emergency-numbers", () => {
	it("returns 200 with the projected DTO for a valid ISO2", async () => {
		getEmergencyNumbersMock.mockResolvedValue(sample)
		const res = await GET(makeRequest("?iso2=CO"))
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual(sample)
		expect(getEmergencyNumbersMock).toHaveBeenCalledWith("CO")
	})

	it("returns 400 when iso2 is missing", async () => {
		const res = await GET(makeRequest(""))
		expect(res.status).toBe(400)
		const body = (await res.json()) as { error?: string }
		expect(body.error).toBe("Invalid ISO 3166-1 alpha-2 code")
		expect(getEmergencyNumbersMock).not.toHaveBeenCalled()
	})

	it("returns 400 for non-uppercase iso2=co", async () => {
		const res = await GET(makeRequest("?iso2=co"))
		expect(res.status).toBe(400)
		expect(getEmergencyNumbersMock).not.toHaveBeenCalled()
	})

	it("returns 400 for short iso2=ab (regex fail)", async () => {
		const res = await GET(makeRequest("?iso2=ab"))
		expect(res.status).toBe(400)
		expect(getEmergencyNumbersMock).not.toHaveBeenCalled()
	})

	it("returns 400 for long iso2=usa (length fail)", async () => {
		const res = await GET(makeRequest("?iso2=usa"))
		expect(res.status).toBe(400)
		expect(getEmergencyNumbersMock).not.toHaveBeenCalled()
	})

	it("returns 502 when the cached service returns null", async () => {
		getEmergencyNumbersMock.mockResolvedValue(null)
		const res = await GET(makeRequest("?iso2=CO"))
		expect(res.status).toBe(502)
		const body = (await res.json()) as { error?: string }
		expect(body.error).toBe("Upstream unavailable")
	})

	it("returns 502 when the cached service throws a non-abort error", async () => {
		getEmergencyNumbersMock.mockRejectedValue(new Error("network down"))
		const res = await GET(makeRequest("?iso2=CO"))
		expect(res.status).toBe(502)
		const body = (await res.json()) as { error?: string }
		expect(body.error).toBe("Upstream unavailable")
	})

	it("returns 504 when the cached service throws an AbortError", async () => {
		const abort = new Error("aborted")
		abort.name = "AbortError"
		getEmergencyNumbersMock.mockRejectedValue(abort)
		const res = await GET(makeRequest("?iso2=CO"))
		expect(res.status).toBe(504)
		const body = (await res.json()) as { error?: string }
		expect(body.error).toBe("Upstream timed out")
	})

	it("returns 504 when the cached service throws a TimeoutError", async () => {
		const timeout = new Error("timed out")
		timeout.name = "TimeoutError"
		getEmergencyNumbersMock.mockRejectedValue(timeout)
		const res = await GET(makeRequest("?iso2=CO"))
		expect(res.status).toBe(504)
	})
})

describe("fetchEmergencyNumbers (fetcher layer)", () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("forwards the lowercased iso2 in the URL path", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(sample),
		})
		await fetchEmergencyNumbers("CO")
		expect(fetchMock).toHaveBeenCalledOnce()
		const [url] = fetchMock.mock.calls[0] as [string]
		expect(url).toMatch(/\/api\/country\/co$/)
	})

	it("forwards User-Agent, Accept: application/json, and cache: no-store", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(sample),
		})
		await fetchEmergencyNumbers("CO")
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		const headers = init.headers as Record<string, string>
		expect(headers["User-Agent"]).toBeTruthy()
		expect(headers.Accept).toBe("application/json")
		expect(init.cache).toBe("no-store")
	})

	it("projects the upstream payload and drops ISONumeric / disclaimer", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					status: "ok",
					data: {
						country: {
							name: "Colombia",
							iso2: "CO",
							ISONumeric: "170",
							disclaimer:
								"This product includes data from emergencynumberapi.com",
							dispatch: { all: ["123"] },
							police: { all: ["112"] },
							ambulance: { all: ["125"] },
							fire: { all: ["119"] },
							member_112: false,
						},
					},
				}),
		})
		const result = await fetchEmergencyNumbers("CO")
		expect(result).toEqual(sample)
		expect(JSON.stringify(result)).not.toContain("ISONumeric")
		expect(JSON.stringify(result)).not.toContain("disclaimer")
	})

	it("returns primary=null when dispatch.all is empty", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					data: {
						country: {
							name: "Atlantis",
							iso2: "AT",
							dispatch: { all: [] },
							police: { all: [] },
							ambulance: { all: [] },
							fire: { all: [] },
							member_112: false,
						},
					},
				}),
		})
		const result = await fetchEmergencyNumbers("AT")
		expect(result.primary).toBeNull()
		expect(result.all.dispatch).toEqual([])
	})

	it("throws EmergencyFetchError on non-OK upstream", async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			status: 500,
			json: () => Promise.reject(new Error("no body")),
		})
		await expect(fetchEmergencyNumbers("CO")).rejects.toMatchObject({
			name: "EmergencyFetchError",
			status: 500,
		})
	})

	it("propagates fetch network errors", async () => {
		fetchMock.mockRejectedValue(new Error("network down"))
		await expect(fetchEmergencyNumbers("CO")).rejects.toThrow("network down")
	})
})
