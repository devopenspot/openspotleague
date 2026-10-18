import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
	acquireOpenWeatherToken,
	releaseOpenWeatherToken,
	recordOpenWeatherRateLimit,
	recordOpenWeatherRateBudget,
	getOpenWeatherStats,
	__resetOpenWeatherBucketForTests,
} from "./rate-limit"
import { OpenWeatherRateLimitError } from "./types"

beforeEach(() => {
	__resetOpenWeatherBucketForTests()
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe("acquireOpenWeatherToken", () => {
	it("grants up to 50 tokens immediately", async () => {
		for (let i = 0; i < 50; i++) {
			await acquireOpenWeatherToken()
		}
		const stats = getOpenWeatherStats()
		expect(stats.acquired).toBe(50)
		expect(stats.inflight).toBe(50)
	})

	it("blocks the 51st acquire until a refill", async () => {
		for (let i = 0; i < 50; i++) {
			await acquireOpenWeatherToken()
		}
		let resolved = false
		const waiting = acquireOpenWeatherToken().then(() => {
			resolved = true
		})
		await Promise.resolve()
		expect(resolved).toBe(false)
		// Advance past one refill interval (60_000 / 50 = 1200ms)
		await vi.advanceTimersByTimeAsync(1200)
		await waiting
		expect(resolved).toBe(true)
	})

	it("releases a single waiter per refill tick (smooth leak)", async () => {
		for (let i = 0; i < 50; i++) {
			await acquireOpenWeatherToken()
		}
		const w1 = acquireOpenWeatherToken()
		const w2 = acquireOpenWeatherToken()
		// Smooth leak: 1 token per tick, not 50-at-once. The first
		// waiter resolves at 1200ms; the second waits for the next
		// tick at 2400ms.
		await vi.advanceTimersByTimeAsync(1200)
		await w1
		expect(getOpenWeatherStats().acquired).toBe(51)
		await vi.advanceTimersByTimeAsync(1200)
		await w2
		expect(getOpenWeatherStats().acquired).toBe(52)
	})

	it("a third waiter waits for the next refill window", async () => {
		for (let i = 0; i < 50; i++) {
			await acquireOpenWeatherToken()
		}
		// 51 waiters; only 1 token leaks per 1200ms tick.
		const waiters = Array.from({ length: 3 }, () => acquireOpenWeatherToken())
		await vi.advanceTimersByTimeAsync(1200)
		const settled = await Promise.allSettled(waiters.slice(0, 1))
		for (const r of settled) expect(r.status).toBe("fulfilled")
		// The 2nd and 3rd are still pending.
		await vi.advanceTimersByTimeAsync(1200)
		const next = await Promise.allSettled(waiters.slice(1, 2))
		for (const r of next) expect(r.status).toBe("fulfilled")
		await vi.advanceTimersByTimeAsync(1200)
		await waiters[2]
		expect(getOpenWeatherStats().acquired).toBe(53)
	})
})

describe("releaseOpenWeatherToken", () => {
	it("decrements inflight", async () => {
		await acquireOpenWeatherToken()
		expect(getOpenWeatherStats().inflight).toBe(1)
		releaseOpenWeatherToken()
		expect(getOpenWeatherStats().inflight).toBe(0)
		releaseOpenWeatherToken()
		expect(getOpenWeatherStats().inflight).toBe(0)
	})
})

describe("recordOpenWeatherRateLimit", () => {
	it("increments the rateLimited counter and opens the circuit for the given Retry-After", () => {
		recordOpenWeatherRateLimit(30)
		const stats = getOpenWeatherStats()
		expect(stats.rateLimited).toBe(1)
		expect(stats.circuitOpenUntil).toBeGreaterThan(Date.now())
		expect(stats.lastRetryAfterSeconds).toBe(30)
	})

	it("defaults to a 60s pause when no Retry-After is supplied", () => {
		recordOpenWeatherRateLimit()
		const stats = getOpenWeatherStats()
		expect(stats.lastRetryAfterSeconds).toBe(60)
		expect(stats.circuitOpenUntil).toBeGreaterThan(Date.now() + 50_000)
	})

	it("extends the circuit window with the larger of two overlapping 429s", () => {
		recordOpenWeatherRateLimit(20)
		const first = getOpenWeatherStats().circuitOpenUntil
		recordOpenWeatherRateLimit(5)
		// The shorter second pause must not retract the longer first.
		expect(getOpenWeatherStats().circuitOpenUntil).toBe(first)
	})

	it("a 429 makes acquireOpenWeatherToken fail fast without consuming a token", async () => {
		// Fill the bucket so we can prove the 429 path doesn't touch it.
		for (let i = 0; i < 50; i++) {
			await acquireOpenWeatherToken()
		}
		const tokensBefore = getOpenWeatherStats().acquired
		recordOpenWeatherRateLimit(30)

		await expect(acquireOpenWeatherToken()).rejects.toBeInstanceOf(
			OpenWeatherRateLimitError,
		)
		const stats = getOpenWeatherStats()
		// Acquire threw, so neither tokens nor acquired moved.
		expect(stats.acquired).toBe(tokensBefore)
		expect(stats.rateLimited).toBe(1)
	})

	it("the circuit closes once the Retry-After window elapses", async () => {
		recordOpenWeatherRateLimit(30)
		await expect(acquireOpenWeatherToken()).rejects.toBeInstanceOf(
			OpenWeatherRateLimitError,
		)
		vi.setSystemTime(Date.now() + 31_000)
		// Bucket is empty from the test setup, so this should still
		// wait on the leak — but it must NOT throw the
		// `OpenWeatherRateLimitError` from the circuit.
		const waited = acquireOpenWeatherToken()
		await vi.advanceTimersByTimeAsync(1200)
		await expect(waited).resolves.toBeUndefined()
	})
})

describe("recordOpenWeatherRateBudget", () => {
	it("opens the circuit when remaining drops below the threshold and reset is in the future", () => {
		const resetAt = Math.floor(Date.now() / 1000) + 30
		recordOpenWeatherRateBudget(3, resetAt)
		const stats = getOpenWeatherStats()
		expect(stats.circuitOpenUntil).toBeGreaterThan(Date.now())
		expect(stats.lastRetryAfterSeconds).toBeGreaterThanOrEqual(1)
	})

	it("does nothing when remaining is above the threshold", () => {
		const resetAt = Math.floor(Date.now() / 1000) + 30
		recordOpenWeatherRateBudget(60, resetAt)
		expect(getOpenWeatherStats().circuitOpenUntil).toBe(0)
	})

	it("does nothing when reset is in the past", () => {
		const resetAt = Math.floor(Date.now() / 1000) - 30
		recordOpenWeatherRateBudget(0, resetAt)
		expect(getOpenWeatherStats().circuitOpenUntil).toBe(0)
	})
})
