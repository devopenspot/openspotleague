import { z } from "zod";
import {
  isValidCalendarDate,
  isValidEventDateRange,
} from "@/lib/sport-events/validation";
import type {
  EventLifecycleStatus,
  EventOrigin,
  EventVisibility,
} from "@/types/sport-events";

export const SportDisciplineSchema = z.enum([
  "Skateboard",
  "BMX",
  "Scooter",
  "Roller",
]);

export const SportEventCategorySchema = z.enum([
  "world-tour",
  "championship",
  "festival",
  "federation",
  "local-event",
]);

export const EventOriginSchema = z.enum(["seed", "community"]);
export const EventVisibilitySchema = z.enum(["public", "unlisted"]);
export const EventLifecycleStatusSchema = z.enum([
  "draft",
  "registration_open",
  "registration_closed",
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);

export const TimezoneSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "timezone must be a valid IANA time zone");

export const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use HTTP or HTTPS");

export const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine(isValidCalendarDate, "Date must be a valid calendar date");

export const CitySlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "citySlug must be lowercase kebab-case");

export const CountryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "countryCode must be a 2-letter ISO code");

export const SportEventLocationSchema = z.object({
  city: z.string().min(1),
  citySlug: CitySlugSchema.optional(),
  address: z.string().optional(),
  country: z.string().min(1),
  countryCode: CountryCodeSchema.optional(),
  venue: z.string().optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
}).strict().superRefine((location, ctx) => {
  if ((location.latitude === undefined) !== (location.longitude === undefined)) {
    ctx.addIssue({
      code: "custom",
      message: "latitude and longitude must both be set or both be omitted",
      path: ["latitude"],
    });
  }
});

export const SportEventSchema = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    name: z.string(),
    shortName: z.string().optional(),
    url: HttpUrlSchema.nullable(),
    image: z.string(),
    imagePath: z.string().nullable().optional(),
    description: z.string(),
    sports: z.array(SportDisciplineSchema),
    startDate: CalendarDateSchema,
    endDate: CalendarDateSchema.optional(),
    location: SportEventLocationSchema,
    category: SportEventCategorySchema,
    categoryName: z.string().min(1),
    featured: z.boolean().optional(),
    origin: EventOriginSchema,
    visibility: EventVisibilitySchema,
    lifecycleStatus: EventLifecycleStatusSchema,
    timezone: z.string().min(1),
    spotName: z.string().nullable().optional(),
    instagram: HttpUrlSchema.nullable().optional(),
    youtube: HttpUrlSchema.nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (!isValidEventDateRange(event.startDate, event.endDate)) {
      ctx.addIssue({
        code: "custom",
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
  })
  .transform((raw) => ({
    id: raw.id,
    slug: raw.slug ?? raw.id,
    name: raw.name,
    shortName: raw.shortName,
    url: raw.url,
    image: raw.image,
    imagePath: raw.imagePath,
    description: raw.description,
    sports: raw.sports,
    startDate: raw.startDate,
    endDate: raw.endDate,
    location: raw.location,
    category: raw.category,
    categoryName: raw.categoryName,
    featured: raw.featured,
    origin: raw.origin,
    visibility: raw.visibility,
    lifecycleStatus: raw.lifecycleStatus,
    timezone: raw.timezone,
    spotName: raw.spotName,
    instagram: raw.instagram,
    youtube: raw.youtube,
    createdAt: raw.createdAt ?? "2024-01-01T00:00:00.000Z",
    updatedAt: raw.updatedAt ?? "2024-01-01T00:00:00.000Z",
  }));

export const SportEventQuerySchema = z
  .object({
    q: z.string().optional(),
    country: z.string().min(1).optional(),
    citySlug: CitySlugSchema.optional(),
    category: SportEventCategorySchema.optional(),
    discipline: SportDisciplineSchema.optional(),
    featured: z.boolean().optional(),
    from: CalendarDateSchema.optional(),
    to: CalendarDateSchema.optional(),
    cursor: z.string().optional(),
    seed: z.string().uuid().optional(),
    random: z.boolean().optional(),
    limit: z.number().int().positive().max(200).default(50),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.random && !val.seed) {
      ctx.addIssue({
        code: "custom",
        message: "seed is required when random is true",
        path: ["seed"],
      })
    }
  });

export const SportEventEnrichedSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().optional(),
  url: HttpUrlSchema.nullable(),
  image: z.string().min(1),
  imagePath: z.string().nullable().optional(),
  description: z.string(),
  sports: z.array(SportDisciplineSchema),
  startDate: CalendarDateSchema,
  endDate: CalendarDateSchema.optional(),
  location: SportEventLocationSchema,
  category: SportEventCategorySchema,
  categoryName: z.string().min(1),
  featured: z.boolean().optional(),
  origin: EventOriginSchema,
  visibility: EventVisibilitySchema,
  lifecycleStatus: EventLifecycleStatusSchema,
  timezone: z.string().min(1),
  spotName: z.string().nullable().optional(),
  instagram: HttpUrlSchema.nullable().optional(),
  youtube: HttpUrlSchema.nullable().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  status: z.enum(["upcoming", "live", "completed"]),
  dateRangeLabel: z.string().min(1),
}).strict();

export const SportEventListResponseSchema = z.object({
  items: z.array(SportEventEnrichedSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
}).strict();

/**
 * Status filter for `/sport-events?status=…`. The status field is
 * derived from `event.startDate` / `event.endDate`, so this is a
 * client-side projection, not a DB column. The default is `all`
 * (no param) and is not serialized in the URL.
 */
export const SportEventStatusFilterSchema = z.enum([
  "all",
  "live",
  "upcoming",
  "completed",
]);

export type SportEventStatusFilter = z.infer<typeof SportEventStatusFilterSchema>;

/**
 * Single map layer for `/map?layer=…`. The URL stores an arbitrary
 * subset of these (comma-separated); the absence of the param means
 * every layer is on. `useMapLayer` is the only reader; the toggle
 * UI lives in `src/components/map/LayerToggle.tsx`.
 */
export const MapLayerSchema = z.enum(["spots", "events"]);

export type MapLayer = z.infer<typeof MapLayerSchema>;

/**
 * Fields a client supplies when creating a sport event. `slug`, `id`,
 * `createdAt`, and `updatedAt` are server-derived and not part of the
 * input contract.
 *
 * Mirrors the `spots` create input (see `NewSpotSchema`): an event can
 * carry a `citySlug`, an `address`, an uploaded `imagePath` alongside
 * the public `image`, and Instagram / YouTube profile URLs. All
 * event-only add-ons (venue, short name, category, dates, featured) are
 * preserved. `origin` defaults to `seed` (admin-curated content);
 * the league create flow sets `community` server-side.
 */
export const NewSportEventSchema = z
  .object({
    id: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    shortName: z.string().optional(),
    url: HttpUrlSchema.nullable().optional(),
    image: HttpUrlSchema,
    imagePath: z.string().nullable().optional(),
    description: z.string().default(""),
    sports: z.array(SportDisciplineSchema).default([]),
    startDate: CalendarDateSchema,
    endDate: CalendarDateSchema.optional(),
    city: z.string().min(1),
    citySlug: CitySlugSchema.optional(),
    address: z.string().optional(),
    country: z.string().min(1),
    countryCode: CountryCodeSchema.optional(),
    venue: z.string().optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    category: SportEventCategorySchema,
    origin: EventOriginSchema.optional(),
    visibility: EventVisibilitySchema.optional(),
    status: EventLifecycleStatusSchema.optional(),
    timezone: TimezoneSchema.optional(),
    featured: z.boolean().default(false),
    instagram: HttpUrlSchema.nullable().optional(),
    youtube: HttpUrlSchema.nullable().optional(),
    createdBy: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if ((event.latitude === undefined) !== (event.longitude === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "latitude and longitude must both be set or both be omitted",
        path: ["latitude"],
      });
    }
    if (!isValidEventDateRange(event.startDate, event.endDate)) {
      ctx.addIssue({
        code: "custom",
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
  });

/**
 * Patch payload for editing a sport event. All fields are optional; only
 * the keys present in the input are updated.
 *
 * `latitude` and `longitude` must both be set when an event is edited. The
 * API preserves existing coordinates when neither key is present.
 */
export const SportEventPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    shortName: z.string().optional(),
    url: HttpUrlSchema.nullable().optional(),
    image: HttpUrlSchema.optional(),
    imagePath: z.string().nullable().optional(),
    description: z.string().optional(),
    sports: z.array(SportDisciplineSchema).optional(),
    startDate: CalendarDateSchema.optional(),
    endDate: CalendarDateSchema.nullable().optional(),
    city: z.string().min(1).optional(),
    citySlug: CitySlugSchema.optional(),
    address: z.string().optional(),
    country: z.string().min(1).optional(),
    countryCode: CountryCodeSchema.optional(),
    venue: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    category: SportEventCategorySchema.optional(),
    visibility: EventVisibilitySchema.optional(),
    status: EventLifecycleStatusSchema.optional(),
    timezone: TimezoneSchema.optional(),
    featured: z.boolean().optional(),
    instagram: HttpUrlSchema.nullable().optional(),
    youtube: HttpUrlSchema.nullable().optional(),
  })
  .strict()
  .superRefine((patch, ctx) => {
    if ((patch.latitude === undefined) !== (patch.longitude === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "latitude and longitude must both be set or both be omitted",
        path: ["latitude"],
      });
    }
    if (
      patch.startDate !== undefined &&
      patch.endDate !== undefined &&
      !isValidEventDateRange(patch.startDate, patch.endDate)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "endDate must be on or after startDate",
        path: ["endDate"],
      });
    }
  });

export type EventLifecycle = EventLifecycleStatus;
export type EventOriginValue = EventOrigin;
export type EventVisibilityValue = EventVisibility;
