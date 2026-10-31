import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

// Workers only see declared bindings. bindings.secret() makes a name required
// at deploy time, so list only variables that have a value: the schema in
// src/lib/config/env.ts defaults the rest. To turn on an optional one, add it
// here and to .env.local, then run `pnpm deploy:secrets`, which uploads the
// declared names from .env.local. NEXT_PUBLIC_* entries are included because
// that schema parses process.env at runtime, where only literal
// process.env.NEXT_PUBLIC_* references have been inlined.
const secretNames = [
  "ADMIN_EMAILS",
  "API_KEY_WEATHER",
  "APP_URL",
  "DB_CONNECT_TIMEOUT_SECONDS",
  "DB_IDLE_TIMEOUT_SECONDS",
  "DB_POOL_MAX",
  "DB_STATEMENT_TIMEOUT_MS",
  "EMERGENCY_API_URL",
  "EMERGENCY_USER_AGENT",
  "GAME_LOCATION_MAX_ACCURACY_METERS",
  "GAME_LOCATION_VERIFICATION_TTL_SECONDS",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NOMINATIM_URL",
  "NOMINATIM_USER_AGENT",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_EVENTS",
  "R2_BUCKET_SPOTS",
  "R2_PUBLIC_DOMAIN_EVENTS",
  "R2_PUBLIC_DOMAIN_SPOTS",
  "R2_SECRET_ACCESS_KEY",
  "STORAGE_PROVIDER",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_URL",
  "URL_WEATHER",
  "URL_WEATHER_IMG",
] as const;

const secrets = Object.fromEntries(
  secretNames.map((name) => [name, bindings.secret()]),
);

// The Worker's only route to Postgres. Local dev connects through
// CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE.
const HYPERDRIVE_ID = "841f5f5d72a4422f946061a9faa441f4";

const responseStore = await createWorkersResponseStoreServiceBindingConfig({
  worker: {
    name: "open-spot-response-store",
    compatibilityDate: "2026-10-30",
    compatibilityFlags: ["nodejs_compat"],
  },
  bucket: "open-spot-response-store-cache-bodies",
});

export const responseStoreServiceBinding = responseStore.serviceBindingWorker;

export default defineConfig({
  worker: defineWorker({
    ...responseStore.applicationWorker,
    name: "open-spot",
    entrypoint: "./src/worker.ts",
    compatibilityDate: "2026-10-30",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ...responseStore.applicationWorker.env,
      ...secrets,
      ASSETS: bindings.assets(),
      HYPERDRIVE: bindings.hyperdrive({ id: HYPERDRIVE_ID }),
    },
  }),
});
