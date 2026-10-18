import { z } from "zod";

export const preferenceDistanceUnitSchema = z.enum(["mi", "km"]);
export const preferenceTemperatureUnitSchema = z.enum(["C", "F"]);
export const preferenceDisciplineSchema = z.enum(["roller", "skateboard", "bmx", "scooter"]).nullable();

export const preferencesSchema = z.object({
  distanceUnit: preferenceDistanceUnitSchema,
  temperatureUnit: preferenceTemperatureUnitSchema,
  disciplineSlug: preferenceDisciplineSchema,
}).strict();

export const updatePreferencesSchema = preferencesSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one preference is required",
);

export type Preferences = z.infer<typeof preferencesSchema>;
