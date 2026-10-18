import { describe, expect, it } from "vitest"
import { verifyLocation } from "@/lib/games/location"

const spot = { latitude: 40.7128, longitude: -74.006 }

describe("location verification", () => {
  it("accepts a rider within the configured radius and accuracy", () => {
    expect(verifyLocation({ latitude: spot.latitude, longitude: spot.longitude, accuracyMeters: 10 }, spot, { radiusMeters: 250, maxAccuracyMeters: 50 })).toMatchObject({ status: "verified", distanceMeters: 0 })
  })

  it("reports low accuracy separately from distance failure", () => {
    const decision = verifyLocation({ latitude: spot.latitude, longitude: spot.longitude, accuracyMeters: 51 }, spot, { radiusMeters: 250, maxAccuracyMeters: 50 })
    expect(decision.status).toBe("rejected")
    if (decision.status === "rejected") expect(decision.reason).toBe("low_accuracy")
  })

  it("rejects positions outside the configured radius", () => {
    const decision = verifyLocation({ latitude: 40.72, longitude: -74.006, accuracyMeters: 10 }, spot, { radiusMeters: 250, maxAccuracyMeters: 50 })
    expect(decision.status).toBe("rejected")
    if (decision.status === "rejected") expect(decision.reason).toBe("too_far")
  })
})
