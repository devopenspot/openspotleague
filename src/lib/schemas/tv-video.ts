import { z } from "zod";
import { parseYouTubeVideoUrl } from "@/lib/tv/urls";

export const TvCategorySchema = z
  .string()
  .trim()
  .min(1, "Category cannot be empty")
  .max(32, "Each category must be at most 32 characters")
  .transform((val) => val.toLowerCase());

export const TvCategoriesSchema = z
  .array(TvCategorySchema)
  .min(1, "Add at least one category")
  .max(12, "A video can have at most 12 categories")
  .refine(
    (cats) => new Set(cats.map((c) => c.toLowerCase())).size === cats.length,
    "Categories must be unique",
  );

export const TvVideoFieldsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  youtubeUrl: z.string().trim().url(),
  disciplineSlug: z.string().trim().min(1).max(64),
  categories: TvCategoriesSchema,
  postDate: z.coerce.date(),
  published: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const TvVideoInputSchema = TvVideoFieldsSchema.superRefine(
  (value, ctx) => {
    const parsed = parseYouTubeVideoUrl(value.youtubeUrl);
    if (!parsed) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a public YouTube video link",
        path: ["youtubeUrl"],
      });
    }
    if (value.postDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: "custom",
        message: "Post date cannot be in the future",
        path: ["postDate"],
      });
    }
  },
).transform((value) => {
  const parsed = parseYouTubeVideoUrl(value.youtubeUrl);
  return {
    ...value,
    youtubeUrl: parsed?.canonicalUrl ?? value.youtubeUrl,
    disciplineSlug: value.disciplineSlug.toLowerCase(),
    categories: [
      ...new Set(
        value.categories.map((c) => c.trim().toLowerCase()).filter(Boolean),
      ),
    ],
    postDate: value.postDate.toISOString(),
  };
});

export const TvVideoPatchSchema = TvVideoFieldsSchema.partial().superRefine(
  (value, ctx) => {
    if (value.youtubeUrl !== undefined) {
      const parsed = parseYouTubeVideoUrl(value.youtubeUrl);
      if (!parsed) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a public YouTube video link",
          path: ["youtubeUrl"],
        });
      }
    }
    if (value.postDate !== undefined) {
      const d =
        value.postDate instanceof Date
          ? value.postDate
          : new Date(value.postDate as unknown as string);
      if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        ctx.addIssue({
          code: "custom",
          message: "Post date cannot be in the future",
          path: ["postDate"],
        });
      }
    }
  },
);

export type TvVideoInput = z.infer<typeof TvVideoInputSchema>;
export type TvVideoPatch = z.infer<typeof TvVideoPatchSchema>;
