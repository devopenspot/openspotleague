import { z } from "zod"

export const TaxonomyEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).max(10000),
}).strict()

export const TaxonomyPatchSchema = TaxonomyEntrySchema.omit({ slug: true }).partial().strict()

export const TrickCatalogEntrySchema = z.object({
  sourceId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  compatibleSpotTypes: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).refine((slugs) => new Set(slugs).size === slugs.length, "Compatible spot types must be unique"),
  categories: z.array(z.string().trim().min(1).max(32)).max(12).default([]).refine((cats) => new Set(cats.map((c) => c.toLowerCase())).size === cats.length, "Categories must be unique"),
}).strict()
