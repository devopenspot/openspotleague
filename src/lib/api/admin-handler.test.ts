import { describe, expect, it } from "vitest"
import { mapMutationErrorResponse } from "./admin-handler"
import {
  InvalidConcurrencyTokenError,
  InvalidReferenceError,
  StaleRecordError,
} from "@/lib/repositories/core/errors"
import { TimeoutError } from "@/lib/db/client"
import { log } from "@/lib/utils/log"

function map(error: unknown) {
  return mapMutationErrorResponse(error, {
    serviceName: "spots",
    notFoundPrefixes: ["Spot not found"],
    logLabel: "test.failed",
    log: log.error,
  })
}

describe("mapMutationErrorResponse", () => {
  it("maps stale records to 409 keeping the message", () => {
    expect(map(new StaleRecordError("The record changed. Reload and retry.")).status).toBe(409)
  })

  it("maps invalid concurrency tokens to 400", () => {
    expect(map(new InvalidConcurrencyTokenError()).status).toBe(400)
  })

  it("maps invalid references to 400", () => {
    expect(map(new InvalidReferenceError("Unknown discipline: bmx")).status).toBe(400)
  })

  it("maps not-found message prefixes to 404 with the message", async () => {
    const res = map(new Error("Spot not found: sp-1"))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("Spot not found: sp-1")
  })

  it("maps timeout/connection errors to a generic 503", () => {
    expect(map(new TimeoutError(15_000)).status).toBe(503)
  })

  it("maps unknown failures to 500 without echoing the message", async () => {
    const res = map(new Error("secret internal detail"))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("Internal error")
    expect(body.error).not.toContain("secret")
  })

  it("returns a NextResponse for non-Error throws", () => {
    expect(map("boom").status).toBe(500)
  })
})
