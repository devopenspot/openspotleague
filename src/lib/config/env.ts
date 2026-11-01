import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const optionalString = () => z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = () =>
  z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalInteger = (min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(min).max(max).optional(),
  );

function resolveAppUrl(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return undefined;
}

const EnvSchema = z
  .object({
    // Public origin (used by metadataBase, sitemap, robots).
    APP_URL: z.preprocess(
      resolveAppUrl,
      z.string().url().default("https://openspot.example.com"),
    ),

    // Optional public support destinations. Empty values keep the cards in a
    // coming-soon state instead of rendering broken external links.
    NEXT_PUBLIC_BUY_ME_A_COFFEE_URL: optionalUrl(),
    NEXT_PUBLIC_PATREON_URL: optionalUrl(),
    NEXT_PUBLIC_PAYPAL_URL: optionalUrl(),

    // OpenWeather
    URL_WEATHER: z
      .string()
      .url()
      .default("https://api.openweathermap.org")
      .refine((u) => u.startsWith("https://"), "must be https://")
      .superRefine((u, ctx) => {
        try {
          const h = new URL(u).hostname.toLowerCase()
          const isPrivate = ["10.", "192.168.", "172.16.", "172.31.", "127.", "169.254.", "0."].some((p) => h.startsWith(p)) || h === "localhost"
          if (isPrivate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "private IP not allowed" })
        } catch {
          // ignore malformed URL during refinement
        }
      }),
    URL_WEATHER_IMG: z
      .string()
      .url()
      .default("https://openweathermap.org/payload/api/media/file"),
    API_KEY_WEATHER: z.string().default(""),

    // Nominatim
    NOMINATIM_URL: z
      .string()
      .url()
      .default("https://nominatim.openstreetmap.org")
      .refine((u) => u.startsWith("https://"), "must be https://")
      .superRefine((u, ctx) => {
        try {
          const h = new URL(u).hostname.toLowerCase()
          const isPrivate = ["10.", "192.168.", "172.16.", "172.31.", "127.", "169.254.", "0."].some((p) => h.startsWith(p)) || h === "localhost"
          if (isPrivate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "private IP not allowed" })
        } catch {
          // ignore
        }
      }),
    NOMINATIM_USER_AGENT: z
      .string()
      .default("openspot/1.0 (contact@example.com)"),

    // Emergency Number API (emergencynumberapi.com). No API key — the
    // public tier is sufficient. The per-iso2 `"use cache"` boundary in
    // `getEmergencyNumbers` absorbs >99% of calls so the upstream's
    // 5 req/sec ceiling is well above any realistic cold-cache stampede.
    EMERGENCY_API_URL: z
      .string()
      .url()
      .default("https://emergencynumberapi.com")
      .refine((u) => u.startsWith("https://"), "must be https://")
      .superRefine((u, ctx) => {
        try {
          const h = new URL(u).hostname.toLowerCase()
          const isPrivate = ["10.", "192.168.", "172.16.", "172.31.", "127.", "169.254.", "0."].some((p) => h.startsWith(p)) || h === "localhost"
          if (isPrivate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "private IP not allowed" })
        } catch {
          // ignore
        }
      }),
    EMERGENCY_USER_AGENT: z
      .string()
      .default("openspot/1.0 (contact@example.com)"),

    // Supabase server-only project URL and admin key (`sb_secret_...`). Used
    // only for privileged server operations. Never read by the SSR client or
    // the proxy.
    SUPABASE_URL: optionalUrl(),
    SUPABASE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()).superRefine((v, ctx) => {
      if (process.env.NODE_ENV === "production" && !v) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SUPABASE_SECRET_KEY required in production" })
      }
      if (v && v.length < 32) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SUPABASE_SECRET_KEY must be at least 32 characters" })
      }
    }),

    // Browser-public Supabase URL and publishable key (`sb_publishable_...`).
    // The proxy and the @supabase/ssr SSR client both use these — the SSR
    // client because it represents a user-context call that must respect
    // RLS, the proxy because it refreshes the cookie-based user session.
    // The publishable key is safe to expose to the browser; Next.js inlines
    // it at build time. The server-only admin client uses SUPABASE_URL above.
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString(),

    // Supabase Postgres, for Node scripts only. The Worker connects through
    // its HYPERDRIVE binding, so never set these on the Worker.
    //   SUPABASE_DATABASE_URL — pgBouncer Transaction pooler (port 6543).
    //   SUPABASE_DIRECT_URL — direct connection (port 5432). Used by
    //     drizzle-kit for DDL (the pooler is unsafe for migrations).
    SUPABASE_DIRECT_URL: optionalString(),
    SUPABASE_DATABASE_URL: optionalString(),

    // Runtime database pool controls. On Workers the pool is per request; the
    // application applies bounded defaults when these are omitted.
    DB_POOL_MAX: optionalInteger(1, 5),
    DB_IDLE_TIMEOUT_SECONDS: optionalInteger(1, 300),
    DB_CONNECT_TIMEOUT_SECONDS: optionalInteger(1, 30),
    DB_MAX_LIFETIME_SECONDS: optionalInteger(30, 3600),
    DB_STATEMENT_TIMEOUT_MS: optionalInteger(100, 120_000),
    DB_OPERATION_TIMEOUT_MS: optionalInteger(1_000, 120_000),
    DB_POOL_CHECKOUT_TIMEOUT_MS: optionalInteger(100, 30_000),
    DB_POOL_CHECKOUT_MAX_ATTEMPTS: optionalInteger(1, 5),
    DB_CONCURRENCY_MAX: optionalInteger(1, 5),

    // Challenge-game policy. These remain unset until explicitly configured
    // for the deployment; game creation must not silently choose a policy.
    GAME_LOCATION_MAX_ACCURACY_METERS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().optional(),
    ),
    GAME_LOCATION_VERIFICATION_TTL_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().optional(),
    ),

    // Supabase Storage buckets. Event media deliberately uses a separate
    // private bucket so event uploads never share spot storage.
    SUPABASE_STORAGE_BUCKET_SPOTS: z.string().min(1).default("spot-images"),
    SUPABASE_STORAGE_BUCKET_EVENTS: z.string().min(1).default("event-images"),

    // Cloudflare R2 — object plane for images (spots/events). Free tier: 10GB + 10M reads.
    // ACCOUNT_ID from https://<ACCOUNT>.r2.cloudflarestorage.com, bucket names must match R2 dashboard.
    R2_ACCOUNT_ID: optionalString(),
    R2_ACCESS_KEY_ID: optionalString(),
    R2_SECRET_ACCESS_KEY: optionalString(),
    // 2-bucket mode (recommended): separate buckets per entity. Single-bucket legacy still supported via R2_BUCKET.
    R2_BUCKET: optionalString(),
    R2_BUCKET_SPOTS: optionalString(),
    R2_BUCKET_EVENTS: optionalString(),
    R2_PUBLIC_DOMAIN: optionalString(),
    R2_PUBLIC_DOMAIN_SPOTS: optionalString(),
    R2_PUBLIC_DOMAIN_EVENTS: optionalString(),
    STORAGE_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(["r2", "supabase"]).optional(),
    ),

    // Bootstrap-only admin allow-list (CSV of emails, case-insensitive).
    // Seed assigns the admin role to matching existing auth.users rows; it is
    // not consulted during request authorization.
    ADMIN_EMAILS: z.string().default(""),

    RATE_LIMIT_PUBLIC_ENABLED: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()).default(false),

    // Integrity (Phase 5) — cursor HMAC secret defaults to SUPABASE_SECRET_KEY via code, but allow dedicated rotation.
    CURSOR_HMAC_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

    // Legacy (Phase 6)
    LEGACY_CURATOR_BYPASS: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()).default(false),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .passthrough();

function readEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  return parsed.data;
}

export const env = readEnv();

export function resolveDatabaseUrl(
  runtimeUrl: string | undefined,
  directUrl: string | undefined,
): string | null {
  const runtime = runtimeUrl?.trim();
  const direct = directUrl?.trim();
  return runtime || direct || null;
}

/**
 * Postgres URL used by the runtime Drizzle client + the dev-console scripts
 * (`db:seed`, `db:apply`, `db:health`).
 *
 * The build is DB-free and never calls this.
 *
 * Resolution order:
 *   1. The Hyperdrive binding (Workers only, see `setHyperdriveUrl`)
 *   2. SUPABASE_DATABASE_URL (port 6543, pgBouncer pooler — Node default)
 *   3. SUPABASE_DIRECT_URL   (port 5432, direct — local DDL only)
 */
export function getDatabaseUrl(): string | null {
  return (
    hyperdriveUrl ??
    resolveDatabaseUrl(env.SUPABASE_DATABASE_URL, env.SUPABASE_DIRECT_URL)
  );
}

let hyperdriveUrl: string | null = null;

/**
 * Called by `src/worker.ts` on every request. Workers cannot reach the pooler
 * directly: `workerd` rejects the certificate from Supabase's private CA, and
 * postgres.js has no way to skip that check there. Kept at module level
 * because cache regeneration opens connections outside `fetch`.
 */
export function setHyperdriveUrl(url: string): void {
  hyperdriveUrl = url;
}

export function isUsingHyperdrive(): boolean {
  return hyperdriveUrl !== null;
}

/** Direct Postgres connection reserved for reset and schema DDL. */
export function getDirectDatabaseUrl(): string | null {
  return env.SUPABASE_DIRECT_URL?.trim() || null;
}

export function getSupabaseUrl(): string | null {
  return env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

export function getSupabaseAdminUrl(): string | null {
  return env.SUPABASE_URL ?? null;
}

export function getSupabasePublishableKey(): string | null {
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null;
}

export function getSupabaseServiceRoleKey(): string | null {
  return env.SUPABASE_SECRET_KEY ?? null;
}

export function getSpotImagesBucket(): string {
  return env.SUPABASE_STORAGE_BUCKET_SPOTS;
}

export function getEventImagesBucket(): string {
  return env.SUPABASE_STORAGE_BUCKET_EVENTS;
}

// R2 — bucket & domain resolution. Single-bucket legacy (R2_BUCKET) falls back to per-kind bucket.
export function getR2AccountId(): string | null {
  return env.R2_ACCOUNT_ID?.trim() || null;
}

export function getR2AccessKeyId(): string | null {
  return env.R2_ACCESS_KEY_ID?.trim() || null;
}

export function getR2SecretAccessKey(): string | null {
  return env.R2_SECRET_ACCESS_KEY?.trim() || null;
}

export function getR2BucketSpots(): string {
  return env.R2_BUCKET_SPOTS?.trim() || env.R2_BUCKET?.trim() || "openspotleague-spots";
}

export function getR2BucketEvents(): string {
  return env.R2_BUCKET_EVENTS?.trim() || env.R2_BUCKET?.trim() || "openspotleague-events";
}

export function getR2PublicDomainSpots(): string | null {
  return env.R2_PUBLIC_DOMAIN_SPOTS?.trim() || env.R2_PUBLIC_DOMAIN?.trim() || null;
}

export function getR2PublicDomainEvents(): string | null {
  return env.R2_PUBLIC_DOMAIN_EVENTS?.trim() || env.R2_PUBLIC_DOMAIN?.trim() || null;
}

// Legacy single-domain getter (for shim)
export function getR2PublicDomain(): string | null {
  return getR2PublicDomainSpots() ?? getR2PublicDomainEvents();
}

export type StorageProvider = "r2" | "supabase";

export function getStorageProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER) return env.STORAGE_PROVIDER;
  if (getR2AccountId() && getR2AccessKeyId() && getR2SecretAccessKey()) return "r2";
  return "supabase";
}

export function isR2Configured(): boolean {
  return Boolean(getR2AccountId() && getR2AccessKeyId() && getR2SecretAccessKey() && getR2PublicDomain());
}

/** Strict per-bucket readiness check (account + key + secret + domain). */
export function isR2Ready(bucket: "spots" | "events"): boolean {
  const domain = bucket === "spots" ? getR2PublicDomainSpots() : getR2PublicDomainEvents();
  return Boolean(getR2AccountId() && getR2AccessKeyId() && getR2SecretAccessKey() && domain);
}
