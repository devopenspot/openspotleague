import { z } from "zod";
import spotTypesRaw from "@/data/spot_types.json";
import disciplinesRaw from "@/data/disciplines.json";
import eventCategoriesRaw from "@/data/event_categories.json";
import eventPlansRaw from "@/data/event_plans.json";

export interface TaxonomyEntry {
  slug: string;
  name: string;
  sortOrder: number;
}

const TaxonomyEntrySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  sort_order: z.number().int().nonnegative(),
}).transform((entry) => ({
  slug: entry.slug,
  name: entry.name,
  sortOrder: entry.sort_order,
}));

export interface EventPlanEntry {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  maxRiders: number;
  maxJudges: number;
  maxOrganizers: number;
  monthlyEventLimit: number;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
}

const EventPlanEntrySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  price_cents: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  max_riders: z.number().int().positive(),
  max_judges: z.number().int().nonnegative(),
  max_organizers: z.number().int().positive(),
  monthly_event_limit: z.number().int().positive(),
  is_default: z.boolean(),
  active: z.boolean(),
  sort_order: z.number().int().nonnegative(),
}).transform((p) => ({
  slug: p.slug,
  name: p.name,
  description: p.description,
  priceCents: p.price_cents,
  currency: p.currency,
  maxRiders: p.max_riders,
  maxJudges: p.max_judges,
  maxOrganizers: p.max_organizers,
  monthlyEventLimit: p.monthly_event_limit,
  isDefault: p.is_default,
  active: p.active,
  sortOrder: p.sort_order,
}));

export const SPOT_TYPE_SEED: readonly TaxonomyEntry[] = z
  .array(TaxonomyEntrySchema)
  .parse(spotTypesRaw);

export const SPORT_DISCIPLINE_SEED: readonly TaxonomyEntry[] = z
  .array(TaxonomyEntrySchema)
  .parse(disciplinesRaw);

export const EVENT_CATEGORY_SEED: readonly TaxonomyEntry[] = z
  .array(TaxonomyEntrySchema)
  .parse(eventCategoriesRaw);

export const EVENT_PLAN_SEED: readonly EventPlanEntry[] = z
  .array(EventPlanEntrySchema)
  .parse(eventPlansRaw);
