import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const {
	envMock,
	acquireOpenWeatherTokenMock,
	releaseOpenWeatherTokenMock,
	recordOpenWeatherRateLimitMock,
	recordOpenWeatherRateBudgetMock,
	logErrorMock,
} = vi.hoisted(() => ({
	envMock: {
		URL_WEATHER: "https://api.openweathermap.org",
		API_KEY_WEATHER: "test-key",
	},
	acquireOpenWeatherTokenMock: vi.fn(),
	releaseOpenWeatherTokenMock: vi.fn(),
	recordOpenWeatherRateLimitMock: vi.fn(),
	recordOpenWeatherRateBudgetMock: vi.fn(),
	logErrorMock: vi.fn(),
}))

vi.mock("@/lib/config/env", () => ({ env: envMock }))
vi.mock("@/lib/utils/log", () => ({
	log: {
		error: (...args: unknown[]) => logErrorMock(...args),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}))
vi.mock("./rate-limit", () => ({
	acquireOpenWeatherToken: (...args: unknown[]) =>
		acquireOpenWeatherTokenMock(...args),
	releaseOpenWeatherToken: (...args: unknown[]) =>
		releaseOpenWeatherTokenMock(...args),
	recordOpenWeatherRateLimit: (...args: unknown[]) =>
		recordOpenWeatherRateLimitMock(...args),
	recordOpenWeatherRateBudget: (...args: unknown[]) =>
		recordOpenWeatherRateBudgetMock(...args),
}))

import { fetchCurrentWeather } from "./fetchers"

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		...init,
		headers: { "content-type": "application/json", ...(init.headers ?? {}) },
	})
}

beforeEach(() => {
	vi.clearAllMocks()
	acquireOpenWeatherTokenMock.mockResolvedValue(undefined)
	releaseOpenWeatherTokenMock.mockImplementation(() => {})
	recordOpenWeatherRateLimitMock.mockImplementation(() => {})
	recordOpenWeatherRateBudgetMock.mockImplementation(() => {})
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

describe("fetchCurrentWeather URL", () => {
	it("hits the data/2.5/weather endpoint with metric units and the app key", async () => {
		const fetchSpy = vi.fn<typeof fetch>(async () =>
			jsonResponse({
				main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
				weather: [{ description: "clear", icon: "01d" }],
				wind: { speed: 3 },
			}),
		)
		globalThis.fetch = fetchSpy

		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		expect(fetchSpy).toHaveBeenCalledTimes(1)
		const call = fetchSpy.mock.calls[0]
		const url = call ? String(call[0]) : ""
		expect(url).toContain("/data/2.5/weather")
		expect(url).not.toContain("/data/2.5/forecast")
		expect(url).toContain("units=metric")
		expect(url).toContain("appid=test-key")
	})
})

describe("fetchCurrentWeather single-flight", () => {
	it("collapses two concurrent calls for the same coords into one upstream fetch", async () => {
		let upstreamCalls = 0
		globalThis.fetch = vi.fn(async () => {
			upstreamCalls += 1
			// Yield to the microtask queue so the second caller
			// joins the inflight map before this resolves.
			await Promise.resolve()
			return jsonResponse({
				main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
				weather: [{ description: "clear", icon: "01d" }],
				wind: { speed: 3 },
			})
		}) as unknown as typeof fetch

		const [a, b] = await Promise.all([
			fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 }),
			fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 }),
		])
		expect(upstreamCalls).toBe(1)
		expect(a?.main.temp).toBe(20)
		expect(b?.main.temp).toBe(20)
	})

	it("issues separate upstream calls for different coords", async () => {
		let upstreamCalls = 0
		globalThis.fetch = vi.fn(async () => {
			upstreamCalls += 1
			return jsonResponse({
				main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
				weather: [{ description: "clear", icon: "01d" }],
				wind: { speed: 3 },
			})
		}) as unknown as typeof fetch

		await Promise.all([
			fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 }),
			fetchCurrentWeather({ latitude: 40.7128, longitude: -74.006 }),
		])
		expect(upstreamCalls).toBe(2)
	})

	it("issues a new upstream call after the first resolves", async () => {
		let upstreamCalls = 0
		globalThis.fetch = vi.fn(async () => {
			upstreamCalls += 1
			return jsonResponse({
				main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
				weather: [{ description: "clear", icon: "01d" }],
				wind: { speed: 3 },
			})
		}) as unknown as typeof fetch

		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		expect(upstreamCalls).toBe(2)
	})
})

describe("fetchCurrentWeather 429 handling", () => {
	it("passes the Retry-After header (seconds) to recordOpenWeatherRateLimit", async () => {
		globalThis.fetch = vi.fn(async () => {
			return new Response("rate limited", {
				status: 429,
				headers: { "retry-after": "30" },
			})
		}) as unknown as typeof fetch

		const result = await fetchCurrentWeather({
			latitude: 34.043,
			longitude: -118.2673,
		})
		expect(result).toBeNull()
		expect(recordOpenWeatherRateLimitMock).toHaveBeenCalledWith(30)
	})

	it("defaults the Retry-After to 60s when the header is missing", async () => {
		globalThis.fetch = vi.fn(async () => {
			return new Response("rate limited", { status: 429 })
		}) as unknown as typeof fetch

		const result = await fetchCurrentWeather({
			latitude: 34.043,
			longitude: -118.2673,
		})
		expect(result).toBeNull()
		expect(recordOpenWeatherRateLimitMock).toHaveBeenCalledWith(60)
	})
})

describe("fetchCurrentWeather X-RateLimit-Remaining proactive backoff", () => {
	it("calls recordOpenWeatherRateBudget with the headers on a successful response", async () => {
		const reset = Math.floor(Date.now() / 1000) + 30
		globalThis.fetch = vi.fn(async () => {
			return jsonResponse(
				{
					main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
					weather: [{ description: "clear", icon: "01d" }],
					wind: { speed: 3 },
				},
				{
					headers: {
						"x-ratelimit-remaining": "3",
						"x-ratelimit-reset": String(reset),
					},
				},
			)
		}) as unknown as typeof fetch

		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		expect(recordOpenWeatherRateBudgetMock).toHaveBeenCalledWith(3, reset)
	})

	it("does not call recordOpenWeatherRateBudget when the headers are missing", async () => {
		globalThis.fetch = vi.fn(async () =>
			jsonResponse({
				main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
				weather: [{ description: "clear", icon: "01d" }],
				wind: { speed: 3 },
			}),
		) as unknown as typeof fetch

		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		expect(recordOpenWeatherRateBudgetMock).not.toHaveBeenCalled()
	})
})

describe("fetchCurrentWeather fetch timeout", () => {
	it("passes an AbortSignal to the upstream fetch", async () => {
		const fetchSpy = vi.fn<typeof fetch>(async () =>
			jsonResponse({
				main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 50 },
				weather: [{ description: "clear", icon: "01d" }],
				wind: { speed: 3 },
			}),
		)
		globalThis.fetch = fetchSpy

		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		const call = fetchSpy.mock.calls[0]
		const init = call ? call[1] : undefined
		expect(init).toBeDefined()
		expect(init?.signal).toBeInstanceOf(AbortSignal)
	})

	it("returns null and logs the cause code when fetch throws a network error", async () => {
		const networkError = new TypeError("fetch failed")
		;(networkError as { cause?: unknown }).cause = { code: "ENOTFOUND" }
		globalThis.fetch = vi.fn(async () => {
			throw networkError
		}) as unknown as typeof fetch

		const result = await fetchCurrentWeather({
			latitude: 34.043,
			longitude: -118.2673,
		})
		expect(result).toBeNull()
		expect(logErrorMock).toHaveBeenCalledTimes(1)
		const message = String(logErrorMock.mock.calls[0]?.[0] ?? "")
		expect(message).toContain("ENOTFOUND")
		expect(message).toContain("TypeError")
	})

	it("returns null when fetch is aborted by the timeout signal", async () => {
		const timeoutError = new DOMException(
			"The operation was aborted due to timeout",
			"TimeoutError",
		)
		globalThis.fetch = vi.fn(async () => {
			throw timeoutError
		}) as unknown as typeof fetch

		const result = await fetchCurrentWeather({
			latitude: 34.043,
			longitude: -118.2673,
		})
		expect(result).toBeNull()
		expect(logErrorMock).toHaveBeenCalledTimes(1)
		const message = String(logErrorMock.mock.calls[0]?.[0] ?? "")
		expect(message).toContain("TimeoutError")
	})

	it("still releases the rate-limit token when fetch throws", async () => {
		const resetError = new TypeError("fetch failed")
		;(resetError as { cause?: unknown }).cause = { code: "ECONNRESET" }
		globalThis.fetch = vi.fn(async () => {
			throw resetError
		}) as unknown as typeof fetch

		await fetchCurrentWeather({ latitude: 34.043, longitude: -118.2673 })
		expect(releaseOpenWeatherTokenMock).toHaveBeenCalled()
	})
})
