import { z } from "zod";
import { HttpUrlSchema, SportDisciplineSchema } from "./event";
import { MAP_NEARBY_MAX_RADIUS_METERS, SPOT_LIST_HARD_CAP } from "@/lib/config/constants";

const InstagramUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Instagram URL must use HTTP or HTTPS");

/**
 * A single spot type slug. The set of valid values lives in the
 * `spot_types` DB table — the runtime server action validates the
 * incoming string against that set. This schema only enforces
 * "non-empty". Note: a spot carries *zero or more* of these (see
 * `SpotTypeListSchema`), and the canonical `Spot.types` is the
 * denormalized `{slug, name}[]` shape (`SpotTypeRefSchema`).
 */
export const SpotTypeSlugSchema = z.string().min(1);

export const SpotTypeRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
}).strict();

export const SpotTypeListSchema = z.array(SpotTypeSlugSchema).default([]);

export const SpotLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
}).strict();

export const SpotVisibilitySchema = z.enum(["personal", "public"]);
export const SpotOriginSchema = z.enum(["seed", "community", "user_personal"]);

export const SpotSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  citySlug: z.string(),
  address: z.string(),
  types: z.array(SpotTypeRefSchema).default([]),
  sports: z.array(SportDisciplineSchema),
  image: z.string(),
  country: z.string(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  // Public Instagram profile URL for the spot. `null` = no presence.
  // Stored as a full URL so
  // the UI can drop it into an `<a href>` directly.
  instagram: HttpUrlSchema.nullable().optional(),
  // Denormalized total of end-user verifications. Kept in sync by the
  // `bump_verification_count` trigger on `verified_spots`; reads
  // return the live count without an aggregate.
  verificationCount: z.number().int().nonnegative().default(0),
  visibility: SpotVisibilitySchema.default("public"),
  origin: SpotOriginSchema.default("seed"),
  communitySubmissionCount: z.number().int().nonnegative().default(0),
  adminHidden: z.boolean().default(false),
  location: SpotLocationSchema,
  createdBy: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export const SpotListResponseSchema = z.object({
  items: z.array(SpotSchema),
  nextCursor: z.string().nullable(),
}).strict();

const SpotImageUrlSchema = z.string().refine(
  (value) => {
    if (value === "" || value === "x") return true
    const lower = value.toLowerCase()
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) return false
    try {
      const protocol = new URL(value).protocol
      return protocol === "http:" || protocol === "https:"
    } catch {
      return false
    }
  },
  { message: "image must be a valid http(s) URL" },
)

const SpotImagePathSchema = z.string().nullable().optional()

export const NewSpotSchema = z
  .object({
    id: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    city: z.string().min(1),
    citySlug: z.string().min(1).optional(),
    address: z.string(),
    types: SpotTypeListSchema,
    sports: z.array(SportDisciplineSchema).default([]),
    image: SpotImageUrlSchema,
    imagePath: SpotImagePathSchema,
    country: z.string().default(""),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/, "countryCode must be a 2-letter ISO code")
      .optional(),
    location: SpotLocationSchema,
    createdBy: z.string().nullable().default(null),
    // Optional on create. Empty string from the form is coerced to
    // `null` at the API layer; Zod allows the URL-or-null shape.
    instagram: InstagramUrlSchema.nullable().optional(),
  })
  .strict();

export const SpotPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    citySlug: z.string().optional(),
    address: z.string().optional(),
    types: SpotTypeListSchema.optional(),
    sports: z.array(SportDisciplineSchema).optional(),
    image: SpotImageUrlSchema.optional(),
    imagePath: SpotImagePathSchema,
    country: z.string().optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/, "countryCode must be a 2-letter ISO code")
      .optional(),
    location: SpotLocationSchema.optional(),
    // PATCH semantics: present key = update. `null` clears the
    // column; absent key leaves it untouched. A non-empty string
    // must be a valid URL (the admin form does the same).
    instagram: InstagramUrlSchema.nullable().optional(),
  })
  .strict();

export { SPOT_LIST_HARD_CAP };

export const SpotQuerySchema = z
  .object({
    q: z.string().optional(),
    /**
     * Filter to spots that have at least one of the given type slugs
     * (OR semantics). A spot with `types: ["skatepark", "bowl"]` matches
     * `types: ["bowl"]` (and `types: ["skatepark", "rails"]`).
     */
    types: z.array(SpotTypeSlugSchema).optional(),
    country: z.string().optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/, "countryCode must be a 2-letter ISO code")
      .optional(),
    discipline: SportDisciplineSchema.optional(),
    city: z.string().optional(),
    ids: z.array(z.string()).optional(),
    near: z
      .object({
        lat: SpotLocationSchema.shape.lat,
        lon: SpotLocationSchema.shape.lon,
        // Supports the map's Nearby scope walk (largest radius chip = 100 mi).
        // All prior callers stay far below the bound — the community dedup
        // check uses `COMMUNITY_RADIUS_METERS` (300) and the standalone
        // nearby service clamps at `NEARBY_RADIUS_CAP_METERS` (50 km).
        radiusMeters: z
          .number()
          .finite()
          .positive()
          .max(MAP_NEARBY_MAX_RADIUS_METERS),
      })
      .strict()
      .optional(),
    cursor: z.string().optional(),
    seed: z.string().uuid().optional(),
    random: z.boolean().optional(),
    /**
     * Only return spots whose photo is set (image_url non-null and
     * non-blank). Keeps the landing wire from spending page slots on
     * photo-less spots the client would filter out anyway.
     */
    hasImage: z.boolean().optional(),
    scope: z.enum(["public", "created"]).optional(),
    visibility: SpotVisibilitySchema.optional(),
    origin: SpotOriginSchema.optional(),
    adminHidden: z.boolean().optional(),
    includeHidden: z.boolean().optional(),
    /**
     * Optional page size. When absent, the repository returns up to
     * `SPOT_LIST_HARD_CAP` rows. Callers needing more must paginate
     * via `cursor`.
     */
    limit: z.number().int().positive().max(SPOT_LIST_HARD_CAP).optional(),
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
