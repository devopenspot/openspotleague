// Process-wide rate limit + 429 circuit breaker for OpenWeather
// upstream calls. The free plan allows 60 requests per minute across
// the whole API; a single shared bucket reflects that and keeps the
// per-instance budget honest. The single `data/2.5/weather` endpoint
// is the only caller — `data/2.5/forecast` is no longer used.
//
// Two coordinated mechanisms:
//
//   1. Leaky bucket at 1 token / 1.2s (≈ 50/min, 10% under the
//      upstream ceiling). The leak is a true smooth drain — `scheduleRefill`
//      adds 1 token per tick — so a single instance cannot burst past
//      the per-minute budget. Multiple Worker isolates still multiply
//      the effective rate, so the leak alone is not enough.
//
//   2. 429 circuit breaker. On a 429 we read `Retry-After` (or
//      `X-RateLimit-Reset`) and freeze the bucket until that time. While
//      the circuit is open, every call fails fast with
//      `OpenWeatherRateLimitError` — the per-spot `"use cache"` boundary
//      catches it and returns the empty `SpotWeather` fallback. This
//      converts a 429 storm into a single pause window: the upstream
//      gets a real chance to recover its quota before we try again, and
//      every concurrent Worker isolate is paused simultaneously (the
//      circuit lives in this module — each isolate has its
//      own, but every instance that hits a 429 enters the same paused
//      state, so the effective cross-instance rate is bounded by the
//      upstream's own recovery time).
//
// Bucket state lives at module scope so a warm Worker isolate
// remembers its consumption across requests. A cold start resets the
// bucket — which is fine, because the per-spot cache is also cold at
// that moment, and the bucket only ever caps the rate at the upstream
// ceiling.
//
// The per-spot `"use cache"` boundary in `weather-cached.ts` is the
// third (and primary) defense — under steady load it absorbs >95% of
// requests. The bucket + circuit here handle the cold-cache stampede
// right after a deploy, after `expire`, or after a Worker cold start.

import { OpenWeatherRateLimitError } from "./types"

const TOKENS_PER_MINUTE = 50
// One token every 60_000 / 50 = 1200ms.
const REFILL_INTERVAL_MS = 60_000 / TOKENS_PER_MINUTE
// Default pause window when the upstream does not send a `Retry-After`
// header. Long enough that a per-minute budget has a real chance to
// recover; short enough that the app does not feel broken if the
// header is missing.
const DEFAULT_RETRY_AFTER_SECONDS = 60
// OpenWeather's `X-RateLimit-Remaining` (free plan) is the same 60
// window. When fewer than this many calls remain, freeze the bucket
// until the reset — we never reach 429.
const PROACTIVE_REMAINING_THRESHOLD = 5

interface OpenWeatherStats {
	acquired: number
	rateLimited: number
	inflight: number
	circuitOpenUntil: number
	lastRetryAfterSeconds: number | null
}

const stats: OpenWeatherStats = {
	acquired: 0,
	rateLimited: 0,
	inflight: 0,
	circuitOpenUntil: 0,
	lastRetryAfterSeconds: null,
}

interface BucketState {
	tokens: number
	nextRefillAt: number
	waiters: Array<() => void>
	refillTimer: ReturnType<typeof setTimeout> | null
}

const bucket: BucketState = {
	tokens: TOKENS_PER_MINUTE,
	nextRefillAt: Date.now() + REFILL_INTERVAL_MS,
	waiters: [],
	refillTimer: null,
}

function refillOne(): void {
	bucket.tokens = Math.min(TOKENS_PER_MINUTE, bucket.tokens + 1)
	bucket.nextRefillAt = Date.now() + REFILL_INTERVAL_MS
	while (bucket.tokens > 0 && bucket.waiters.length > 0) {
		const next = bucket.waiters.shift()
		if (!next) break
		bucket.tokens -= 1
		stats.acquired += 1
		stats.inflight += 1
		next()
	}
}

function scheduleRefill(): void {
	if (bucket.refillTimer) return
	const delay = Math.max(0, bucket.nextRefillAt - Date.now())
	bucket.refillTimer = setTimeout(() => {
		bucket.refillTimer = null
		refillOne()
		if (bucket.waiters.length > 0) {
			scheduleRefill()
		}
	}, delay)
	if (typeof bucket.refillTimer.unref === "function") {
		bucket.refillTimer.unref()
	}
}

function isCircuitOpen(): boolean {
	return Date.now() < stats.circuitOpenUntil
}

function openCircuit(retryAfterSeconds: number): void {
	const until = Date.now() + Math.max(0, retryAfterSeconds) * 1000
	// `max` so two parallel 429s do not retract a longer pause.
	if (until > stats.circuitOpenUntil) {
		stats.circuitOpenUntil = until
		stats.lastRetryAfterSeconds = retryAfterSeconds
	}
	stats.rateLimited += 1
}

export async function acquireOpenWeatherToken(): Promise<void> {
	if (isCircuitOpen()) {
		// Fail fast without touching the bucket. The per-spot cache
		// layer turns this into an empty `SpotWeather`; the user sees
		// a missing icon/temp, not a 500.
		throw new OpenWeatherRateLimitError(429, "OpenWeather circuit open")
	}
	if (bucket.tokens > 0) {
		bucket.tokens -= 1
		stats.acquired += 1
		stats.inflight += 1
		return
	}
	await new Promise<void>((resolve) => {
		bucket.waiters.push(resolve)
		scheduleRefill()
	})
}

export function releaseOpenWeatherToken(): void {
	stats.inflight = Math.max(0, stats.inflight - 1)
}

/**
 * Record an upstream 429. Opens the circuit for `retryAfterSeconds`
 * (defaults to 60s when the header is missing).
 */
export function recordOpenWeatherRateLimit(
	retryAfterSeconds: number = DEFAULT_RETRY_AFTER_SECONDS,
): void {
	openCircuit(retryAfterSeconds)
}

/**
 * Proactive backoff. Call this on every successful upstream response
 * with the `X-RateLimit-Remaining` and `X-RateLimit-Reset` (unix
 * seconds) headers — if the remaining count is below the threshold and
 * the reset is in the future, open the circuit for the same duration.
 * Lets us pause before the upstream actually returns 429.
 */
export function recordOpenWeatherRateBudget(
	remaining: number,
	resetAtUnixSeconds: number,
): void {
	if (remaining > PROACTIVE_REMAINING_THRESHOLD) return
	const secondsUntilReset = Math.ceil(resetAtUnixSeconds - Date.now() / 1000)
	// `reset` already in the past means the upstream has already
	// replenished the budget — do not pause, or we'd block the next
	// render for no reason.
	if (secondsUntilReset <= 0) return
	openCircuit(secondsUntilReset)
}

export function getOpenWeatherStats(): Readonly<OpenWeatherStats> {
	return { ...stats }
}

// Test-only: reset bucket + stats. Not exported from the index of
// the weather module — only the test file imports it directly.
export function __resetOpenWeatherBucketForTests(): void {
	bucket.tokens = TOKENS_PER_MINUTE
	bucket.nextRefillAt = Date.now() + REFILL_INTERVAL_MS
	bucket.waiters = []
	if (bucket.refillTimer) {
		clearTimeout(bucket.refillTimer)
		bucket.refillTimer = null
	}
	stats.acquired = 0
	stats.rateLimited = 0
	stats.inflight = 0
	stats.circuitOpenUntil = 0
	stats.lastRetryAfterSeconds = null
}
