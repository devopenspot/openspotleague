import { env } from "@/lib/config/env"
import { log } from "@/lib/utils/log"
import { perRequest } from "@/lib/utils/request-scope"
import {
	acquireOpenWeatherToken,
	releaseOpenWeatherToken,
	recordOpenWeatherRateBudget,
	recordOpenWeatherRateLimit,
} from "./rate-limit"
import { OpenWeatherRateLimitError, WeatherConfigError } from "./types"
import type { WeatherItem } from "@/types/weather"

const ENDPOINT_CURRENT = "data/2.5/weather" as const

// Per-call fetch timeout. A hung upstream socket would otherwise hold a
// rate-limit token until the Workers runtime ends the request,
// starving the 6-concurrent fan-out behind it. 5s is a generous ceiling
// for OpenWeather's `data/2.5/weather` (normally <500ms) that catches
// real network failures without false-positives on slow responses.
const FETCH_TIMEOUT_MS = 5000

// In-process single-flight dedupe. Multiple code paths (root layout,
// map layout, per-spot detail) ask for the same `lat,lon,lang` tuple
// inside a single render. Coalescing concurrent calls into one upstream
// fetch is a free win inside a single request — the per-spot
// `"use cache"` boundary already prevents cross-render dedup, so this
// map only ever holds promises that are currently in flight.
// `Map.delete` runs in the `finally` block, so the next caller after
// resolution gets a fresh fetch.
const getInflight = perRequest(() => new Map<string, Promise<unknown>>())

function inflightKey(
	endpoint: string,
	latitude: number,
	longitude: number,
	language: string,
): string {
	// 3-decimal precision (~110m at the equator) collapses
	// sub-pixel coordinate jitter that would otherwise produce
	// duplicate upstream calls for the same spot.
	return `${endpoint}:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${language}`
}

function parseRetryAfter(value: string | null): number {
	if (!value) return 60
	const seconds = Number(value)
	if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds)
	// `Retry-After` can be an HTTP-date. For our 1-min budget window
	// the seconds form is what OpenWeather sends; fall back to the
	// default for any other format rather than guess.
	return 60
}

function parseRateLimitHeaders(headers: Headers): {
	remaining: number | null
	resetAtUnixSeconds: number | null
} {
	const remainingRaw = headers.get("x-ratelimit-remaining")
	const resetRaw = headers.get("x-ratelimit-reset")
	const remaining = remainingRaw !== null ? Number(remainingRaw) : null
	const resetAtUnixSeconds = resetRaw !== null ? Number(resetRaw) : null
	return {
		remaining: Number.isFinite(remaining) ? remaining : null,
		resetAtUnixSeconds: Number.isFinite(resetAtUnixSeconds)
			? resetAtUnixSeconds
			: null,
	}
}

async function requestOpenWeather<T>(endpoint: string, params: {
	latitude: number
	longitude: number
	language: string
}): Promise<T> {
	const base = env.URL_WEATHER
	const key = env.API_KEY_WEATHER
	if (!base || !key) {
		throw new WeatherConfigError(
			"OpenWeather env vars are not set (URL_WEATHER, API_KEY_WEATHER).",
		)
	}
	const url = `${base}/${endpoint}?lat=${params.latitude}&lon=${params.longitude}&appid=${key}&units=metric&lang=${params.language}`

	await acquireOpenWeatherToken()
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		})
		if (response.status === 429) {
			const retryAfter = parseRetryAfter(response.headers.get("retry-after"))
			recordOpenWeatherRateLimit(retryAfter)
			log.error(`OpenWeather ${endpoint} rate-limited (429)`)
			throw new OpenWeatherRateLimitError(
				429,
				`OpenWeather ${endpoint} rate-limited`,
			)
		}
		// Proactive backoff: every successful response carries the
		// `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
		// (OpenWeather returns them on every call). If we are about
		// to run out, freeze the bucket so subsequent calls fail
		// fast — we never reach 429.
		const { remaining, resetAtUnixSeconds } = parseRateLimitHeaders(
			response.headers,
		)
		if (remaining !== null && resetAtUnixSeconds !== null) {
			recordOpenWeatherRateBudget(remaining, resetAtUnixSeconds)
		}
		if (!response.ok) {
			log.error(`OpenWeather ${endpoint} failed: ${response.status}`)
			throw new Error(`OpenWeather ${endpoint} failed: ${response.status}`)
		}
		return (await response.json()) as T
	} finally {
		releaseOpenWeatherToken()
	}
}

function singleFlight<T>(endpoint: string, params: {
	latitude: number
	longitude: number
	language: string
}, fn: () => Promise<T>): Promise<T> {
	const key = inflightKey(
		endpoint,
		params.latitude,
		params.longitude,
		params.language,
	)
	const inflight = getInflight()
	const existing = inflight.get(key) as Promise<T> | undefined
	if (existing) return existing
	const promise = fn().finally(() => {
		inflight.delete(key)
	})
	inflight.set(key, promise)
	return promise
}

export async function fetchCurrentWeather(params: {
	latitude: number
	longitude: number
	language?: string
}): Promise<WeatherItem | null> {
	return singleFlight(
		ENDPOINT_CURRENT,
		{
			latitude: params.latitude,
			longitude: params.longitude,
			language: params.language ?? "en",
		},
		async () => {
			try {
				return await requestOpenWeather<WeatherItem>(ENDPOINT_CURRENT, {
					latitude: params.latitude,
					longitude: params.longitude,
					language: params.language ?? "en",
				})
			} catch (error) {
				if (!(error instanceof OpenWeatherRateLimitError)) {
					const cause = (error as { cause?: unknown }).cause
					const causeCode =
						cause && typeof cause === "object" && "code" in cause
							? String((cause as { code: unknown }).code)
							: "n/a"
					const errorName =
						error instanceof Error ? `${error.name}: ${error.message}` : String(error)
					log.error(
						`Failed to fetch current weather: ${errorName} (cause: ${causeCode})`,
					)
				}
				return null
			}
		},
	)
}
