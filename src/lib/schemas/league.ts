import { z } from "zod";
import {
  CalendarDateSchema,
  CitySlugSchema,
  CountryCodeSchema,
  EventLifecycleStatusSchema,
  EventVisibilitySchema,
  HttpUrlSchema,
  SportDisciplineSchema,
  SportEventCategorySchema,
  TimezoneSchema,
} from "./event";

/**
 * Mutation response contract shared by every league action — mirrors
 * `GameMutationResponse` (`{ id, version }`). The `version` is the
 * post-mutation `sport_events.version` the client must send back as
 * `expectedVersion` on the next write.
 */
export const leagueMutationResponseSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(0),
});

export type LeagueMutationResponse = z.infer<typeof leagueMutationResponseSchema>;

/** Create responses also carry the generated slug for client redirect. */
export const leagueCreateResponseSchema = leagueMutationResponseSchema.extend({
  slug: z.string().min(1),
});

export type LeagueCreateEventResponse = z.infer<typeof leagueCreateResponseSchema>;

/** Common envelope for event mutations (OCC + idempotency). */
export const leagueMutationInputSchema = z.object({
  expectedVersion: z.number().int().min(0),
  idempotencyKey: z.string().uuid(),
});

export type LeagueMutationInput = z.infer<typeof leagueMutationInputSchema>;

// ---------- create ----------

/**
 * User-created (community) event input. The organizer supplies identity,
 * schedule and discipline data; slug, plan (free), lifecycle status,
 * visibility (unlisted) and the payment-gate deadlines are server-derived.
 * The start date must be at most two months in the future (engine rule).
 */
/**
 * Create/join requests carry the idempotency key in the body like every
 * other league mutation (spec line 17); the `x-idempotency-key` header
 * remains accepted for backward compatibility.
 */
export const leagueCreateEventInputSchema = z
  .object({
    idempotencyKey: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    shortName: z.string().max(40).optional(),
    description: z.string().max(2000).default(""),
    sports: z.array(SportDisciplineSchema).min(1),
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
    timezone: TimezoneSchema,
    category: SportEventCategorySchema,
    imageUrl: HttpUrlSchema.optional(),
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
  });

export type CreateLeagueEventInput = z.infer<typeof leagueCreateEventInputSchema>;

// ---------- config patch ----------

export const leagueConfigPatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    shortName: z.string().max(40).optional(),
    description: z.string().max(2000).optional(),
    sports: z.array(SportDisciplineSchema).min(1).optional(),
    startDate: CalendarDateSchema.optional(),
    endDate: CalendarDateSchema.nullable().optional(),
    city: z.string().min(1).optional(),
    citySlug: CitySlugSchema.optional(),
    address: z.string().optional(),
    country: z.string().min(1).optional(),
    countryCode: CountryCodeSchema.optional(),
    venue: z.string().optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    timezone: TimezoneSchema.optional(),
    category: SportEventCategorySchema.optional(),
    visibility: EventVisibilitySchema.optional(),
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
  });

export type LeagueConfigPatch = z.infer<typeof leagueConfigPatchSchema>;

export const leagueConfigPatchInputSchema = leagueMutationInputSchema.extend({
  patch: leagueConfigPatchSchema,
});

// ---------- payment ----------

export const leaguePaymentInputSchema = leagueMutationInputSchema.extend({
  planSlug: z.string().min(1).max(64),
});

export type LeaguePaymentInput = z.infer<typeof leaguePaymentInputSchema>;

// ---------- admin payment transitions ----------

export const leaguePaymentStatusSchema = z.enum([
  "paid",
  "comped",
  "refunded",
  "failed",
]);

export type LeaguePaymentStatus = z.infer<typeof leaguePaymentStatusSchema>;

/** Run reorder payload: every run of the event exactly once, sequences 1..N. */
export const leagueScheduleReorderInputSchema =
  leagueMutationInputSchema.extend({
    slotMinutes: z.number().int().min(5).max(120).optional(),
    runs: z
      .array(
        z.object({
          runId: z.string().min(1),
          sequence: z.number().int().min(1),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const sequences = data.runs.map((run) => run.sequence);
    const runIds = data.runs.map((run) => run.runId);
    if (new Set(sequences).size !== sequences.length) {
      ctx.addIssue({
        code: "custom",
        message: "Run sequences must be unique and contiguous starting at 1",
        path: ["runs"],
      });
    }
    if (new Set(runIds).size !== runIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Every run must appear exactly once",
        path: ["runs"],
      });
    }
  });

export type LeagueScheduleReorderInput = z.infer<
  typeof leagueScheduleReorderInputSchema
>;

export const leagueAdminPaymentActionSchema = z.object({
  status: leaguePaymentStatusSchema,
  providerReference: z.string().max(200).optional(),
});

// ---------- membership (2a) ----------

/** Inviteable roles — the main organizer seat is never invitable. */
export const leagueInviteRoleSchema = z.enum(["organizer", "judge", "rider"]);

export type LeagueInviteRole = z.infer<typeof leagueInviteRoleSchema>;

export const leagueInviteInputSchema = leagueMutationInputSchema.extend({
  role: leagueInviteRoleSchema,
  /** Days until the invite expires; omit = no expiry. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
});

export type LeagueInviteInput = z.infer<typeof leagueInviteInputSchema>;

export const leagueJoinInputSchema = z.object({
  code: z.string().min(6).max(32),
  idempotencyKey: z.string().uuid().optional(),
});

export type LeagueJoinInput = z.infer<typeof leagueJoinInputSchema>;

export const leagueMemberAddInputSchema = leagueMutationInputSchema.extend({
  userId: z.string().uuid(),
  role: leagueInviteRoleSchema,
});

export type LeagueMemberAddInput = z.infer<typeof leagueMemberAddInputSchema>;

export const leagueLeaveInputSchema = leagueMutationInputSchema.omit({
  expectedVersion: true,
});

export type LeagueLeaveInput = z.infer<typeof leagueLeaveInputSchema>;

// ---------- lifecycle (2b) & runs/scores (2c) ----------

/** All lifecycle transitions share the OCC + idempotency envelope. */
export const leagueLifecycleInputSchema = leagueMutationInputSchema;

export const leagueScheduleInputSchema = leagueMutationInputSchema.extend({
  slotMinutes: z.number().int().min(5).max(120).optional(),
});

export type LeagueScheduleInput = z.infer<typeof leagueScheduleInputSchema>;

export const leagueRunWindowModeSchema = z.enum(["open", "extend", "close"]);

export type LeagueRunWindowMode = z.infer<typeof leagueRunWindowModeSchema>;

export const leagueRunWindowInputSchema = leagueMutationInputSchema.extend({
  mode: leagueRunWindowModeSchema,
  /** Ignored for `close`. */
  windowMinutes: z.number().int().min(1).max(60).optional(),
});

export type LeagueRunWindowInput = z.infer<typeof leagueRunWindowInputSchema>;

export const leagueScoreInputSchema = leagueMutationInputSchema.extend({
  scores: z.record(z.string().min(1), z.number().finite().min(0).max(100)),
});

export type LeagueScoreInput = z.infer<typeof leagueScoreInputSchema>;

// ---------- notifications ----------

export const notificationReadInputSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (input) => Boolean(input.all) || (input.ids !== undefined && input.ids.length > 0),
    { message: "Provide ids or all=true" },
  );

export type NotificationReadInput = z.infer<typeof notificationReadInputSchema>;

// ---------- email preferences ----------

export const emailPreferencesInputSchema = z.object({
  emailDigests: z.boolean(),
});

export type EmailPreferencesInput = z.infer<typeof emailPreferencesInputSchema>;

// ---------- admin plans ----------

/** Editable plan fields (slug is immutable — new pricing = new slug). */
export const leaguePlanPatchSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(300).optional(),
    priceCents: z.number().int().min(0).max(1_000_000).optional(),
    currency: z.string().length(3).optional(),
    maxRiders: z.number().int().min(0).max(500).optional(),
    maxJudges: z.number().int().min(0).max(100).optional(),
    maxOrganizers: z.number().int().min(0).max(20).optional(),
    monthlyEventLimit: z.number().int().min(1).max(500).optional(),
    isDefault: z.boolean().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field",
  });

export type LeaguePlanPatch = z.infer<typeof leaguePlanPatchSchema>;

export const leaguePlanCreateInputSchema = leaguePlanPatchSchema.and(
  z.object({
    slug: z
      .string()
      .min(2)
      .max(41)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, digits and dashes"),
  }),
);

export type LeaguePlanCreateInput = z.infer<typeof leaguePlanCreateInputSchema>;

export const leagueAccountPlanActionSchema = z
  .object({
    userId: z.string().uuid(),
    planSlug: z.string().min(2).max(41).optional(),
    action: z.enum(["grant", "revoke"]).default("grant"),
  })
  .refine((input) => input.action === "revoke" || Boolean(input.planSlug), {
    message: "planSlug is required to grant",
  });

export type LeagueAccountPlanAction = z.infer<
  typeof leagueAccountPlanActionSchema
>;

// ---------- misc ----------

export { EventLifecycleStatusSchema, EventVisibilitySchema };
