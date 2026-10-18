import { z } from "zod"

const SourceUuidSchema = z.string().uuid()
const SourceUrlSchema = z.string().url()

/** The checked snake_case shape of the canonical spot source file. */
export const ContentSourceSpotSchema = z
  .object({
    id: SourceUuidSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    city: z.string().min(1),
    city_slug: z.string().min(1),
    address: z.string(),
    image_url: z
      .union([SourceUrlSchema, z.literal(""), z.null()])
      .optional()
      .transform((v) => (!v || v === "" ? null : v)),
    image_path: z.string().nullable().optional(),
    images: z.array(SourceUrlSchema).default([]),
    types: z
      .array(
        z.object({
          name: z.string().min(1),
          slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        }),
      )
      .default([]),
    country_code: z.string().regex(/^[A-Z]{2}$/),
    location: z.string().min(1),
    created_by: SourceUuidSchema.nullable(),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    updated_by: SourceUuidSchema.nullable().optional(),
    visibility: z.string().optional(),
    origin: z.string().optional(),
    community_submission_count: z.number().int().optional(),
    admin_hidden: z.boolean().optional(),
    instagram: z.string().nullable().optional(),
    verification_count: z.number().int().nonnegative(),
    sports: z.array(z.string().min(1)).min(1),
  })
  .strict()

/** The checked snake_case shape of the canonical spot/type assignment file. */
export const ContentSourceSpotTypeAssignmentSchema = z
  .object({
    spot_id: SourceUuidSchema,
    type_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict()
