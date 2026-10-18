import { z } from "zod"
import { haversineMeters } from "@/lib/spots/geo"

export const locationInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().positive(),
}).strict()

export type LocationInput = z.infer<typeof locationInputSchema>
export type LocationPolicy = {
  radiusMeters: number
  maxAccuracyMeters: number
}
export type LocationDecision =
  | { status: "verified"; distanceMeters: number; accuracyMeters: number }
  | { status: "rejected"; reason: "too_far" | "low_accuracy"; distanceMeters: number; accuracyMeters: number }

export function verifyLocation(
  input: LocationInput,
  spot: { latitude: number; longitude: number },
  policy: LocationPolicy,
): LocationDecision {
  const distanceMeters = Math.round(haversineMeters(
    input.latitude,
    input.longitude,
    spot.latitude,
    spot.longitude,
  ))
  if (input.accuracyMeters > policy.maxAccuracyMeters) {
    return { status: "rejected", reason: "low_accuracy", distanceMeters, accuracyMeters: Math.round(input.accuracyMeters) }
  }
  if (distanceMeters > policy.radiusMeters) {
    return { status: "rejected", reason: "too_far", distanceMeters, accuracyMeters: Math.round(input.accuracyMeters) }
  }
  return { status: "verified", distanceMeters, accuracyMeters: Math.round(input.accuracyMeters) }
}
