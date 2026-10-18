import { afterEach, describe, expect, it, vi } from "vitest"
import { log } from "@/lib/utils/log"
import {
  classifyDatabaseError,
  isConnectionError,
  TimeoutError,
  withRetry,
  withTimeout,
} from "./client"

describe("database observability wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("logs a labeled successful operation without query details", async () => {
    const info = vi.spyOn(log, "info")

    await expect(
      withRetry(async () => "ok", {
        maxAttempts: 1,
        label: "events.list",
      }),
    ).resolves.toBe("ok")

    expect(info).toHaveBeenCalledWith(
      "db.operation",
      expect.objectContaining({
        label: "events.list",
        ok: true,
        attempt: 1,
        attempts: 1,
      }),
    )
  })

  it("records a timeout as a failed operation", async () => {
    const warn = vi.spyOn(log, "warn")

    await expect(
      withRetry(
        () => new Promise<string>(() => undefined),
        { maxAttempts: 1, timeoutMs: 5, label: "health.select_1" },
      ),
    ).rejects.toBeInstanceOf(TimeoutError)

    expect(warn).toHaveBeenCalledWith(
      "db.operation",
      expect.objectContaining({
        label: "health.select_1",
        ok: false,
        timedOut: true,
        retryable: false,
      }),
    )
  })

  it("keeps timeout behavior bounded for a standalone operation", async () => {
    await expect(
      withTimeout(() => new Promise<string>(() => undefined), 5),
    ).rejects.toMatchObject({
      name: "TimeoutError",
    })
  })

  it("cancels a postgres-js-style query before reporting a timeout", async () => {
    let canceled = false
    const query = Object.assign(
      new Promise<string>(() => undefined),
      { cancel: () => { canceled = true } },
    )

    await expect(withTimeout(() => query, 5)).rejects.toBeInstanceOf(
      TimeoutError,
    )
    expect(canceled).toBe(true)
  })

  it("does not retry a connection failure when retries are disabled", async () => {
    let attempts = 0

    await expect(
      withRetry(
        async () => {
          attempts += 1
          throw new Error("ECONNRESET")
        },
        { maxAttempts: 3, retryOnConnectionError: false },
      ),
    ).rejects.toThrow("ECONNRESET")

    expect(attempts).toBe(1)
  })

  it("does not classify permanent credential errors as transient", () => {
    expect(isConnectionError(new Error("password authentication failed"))).toBe(
      false,
    )
    expect(isConnectionError(new Error("database does not exist"))).toBe(false)
  })

  it("classifies database failures without treating deterministic errors as transient", () => {
    expect(classifyDatabaseError(new Error("canceling statement due to statement timeout"))).toBe("timeout")
    expect(classifyDatabaseError(Object.assign(new Error("serialization failure"), { code: "40001" }))).toBe("serialization")
    expect(classifyDatabaseError(Object.assign(new Error("deadlock detected"), { code: "40P01" }))).toBe("deadlock")
    expect(classifyDatabaseError(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe("constraint")
    expect(classifyDatabaseError(Object.assign(new Error("permission denied"), { code: "42501" }))).toBe("authorization")
    expect(classifyDatabaseError(new Error("Invalid input"))).toBe("unknown")
    expect(classifyDatabaseError(Object.assign(new Error("connect timed out"), { code: "CONNECT_TIMEOUT" }))).toBe("connection")
  })

  it("retries a transient connection failure but not a constraint failure", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0)
    const warn = vi.spyOn(log, "warn")
    let connectionAttempts = 0
    await expect(
      withRetry(
        async () => {
          connectionAttempts += 1
          if (connectionAttempts < 2) throw new Error("ECONNRESET")
          return "ok"
        },
        { baseDelayMs: 0, label: "test.read" },
      ),
    ).resolves.toBe("ok")
    expect(connectionAttempts).toBe(2)

    let constraintAttempts = 0
    await expect(
      withRetry(
        async () => {
          constraintAttempts += 1
          throw Object.assign(new Error("duplicate key"), { code: "23505" })
        },
        { baseDelayMs: 0, label: "test.write" },
      ),
    ).rejects.toThrow("duplicate key")
    expect(constraintAttempts).toBe(1)
    expect(warn).toHaveBeenCalledWith(
      "db.operation",
      expect.objectContaining({
        errorClass: "constraint",
        retryable: false,
      }),
    )
    random.mockRestore()
  })
})
