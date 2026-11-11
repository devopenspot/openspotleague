import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

// One config, one Worker per environment (docs/environments.md). The build
// mode picks the environment: `pnpm build:develop` / `pnpm build:production`
// (scripts/build.ts) run `vite build --mode <env>`; `vite dev` runs in
// `development` mode, which keeps the local setup of before.

export const DEPLOY_ENVIRONMENTS = ["develop", "production"] as const;
export type DeployEnvironment = (typeof DEPLOY_ENVIRONMENTS)[number];

interface EnvironmentShape {
  worker: string;
  /** Hyperdrive config id: the Worker's only route to Postgres. Query caching must be off. */
  hyperdriveId: string;
  /** Custom domains attached on deploy. Empty keeps what the dashboard has. */
  domains: string[];
  responseStore: { worker: string; bucket: string };
}

export const ENVIRONMENTS: Record<DeployEnvironment, EnvironmentShape> = {
  develop: {
    worker: "open-spot-develop",
    // `open-spot-db`, the develop Supabase project.
    hyperdriveId: "841f5f5d72a4422f946061a9faa441f4",
    domains: ["dev.openspotleague.com"],
    responseStore: {
      worker: "open-spot-develop-response-store",
      bucket: "open-spot-develop-response-store-cache-bodies",
    },
  },
  production: {
    // Keeps the name that owns openspotleague.com and the workers.dev address
    // the AWS Lambdas call.
    worker: "open-spot",
    // `open-spot-db-prod`, the production Supabase project. Empty until it is
    // created (docs/environments.md → One-time setup → Cloudflare); a
    // production build refuses to run without it.
    hyperdriveId: "",
    // The apex domain is attached in the dashboard; leave it there.
    domains: [],
    responseStore: {
      worker: "open-spot-response-store",
      bucket: "open-spot-response-store-cache-bodies",
    },
  },
};

// Real secrets. In develop and production they come from the GitHub
// environment (or `.env.<env>.local` for a break-glass deploy); every name must
// have a value at deploy time. Never list them in the committed env files.
export const SECRET_NAMES = [
  "ADMIN_EMAILS",
  "API_KEY_WEATHER",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_SECRET_ACCESS_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

// Email over AWS (docs/notifications.md). Opt-in until the AWS stack serves
// production: build with OPENSPOT_NOTIFICATIONS=1. Once email is permanently
// on, move these into SECRET_NAMES for production and drop the flag, so a
// deploy without it cannot unset them.
export const NOTIFICATION_SECRET_NAMES = [
  "AWS_NOTIFY_ACCESS_KEY_ID",
  "AWS_NOTIFY_REGION",
  "AWS_NOTIFY_SECRET_ACCESS_KEY",
  "NOTIFICATIONS_INTERNAL_SECRET",
  "NOTIFICATIONS_UNSUBSCRIBE_SECRET",
  "NOTIFY_EMAIL_QUEUE_URL",
] as const;

// Non-secret runtime variables. In develop and production their values come
// from the committed `.env.develop` / `.env.production` and become plain text
// bindings; under `vite dev` they are read from `.env.local` as before.
// NEXT_PUBLIC_* entries are included because src/lib/config/env.ts parses
// process.env at runtime, where only literal process.env.NEXT_PUBLIC_*
// references have been inlined.
export const RUNTIME_VARIABLE_NAMES = [
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
  "R2_BUCKET_EVENTS",
  "R2_BUCKET_SPOTS",
  "R2_PUBLIC_DOMAIN_EVENTS",
  "R2_PUBLIC_DOMAIN_SPOTS",
  "STORAGE_PROVIDER",
  "SUPABASE_URL",
  "URL_WEATHER",
  "URL_WEATHER_IMG",
] as const;

/** Values that must be replaced before an environment can be built. */
export const PLACEHOLDER = "__SET_ME__";

export function isDeployEnvironment(mode: string | undefined): mode is DeployEnvironment {
  return (DEPLOY_ENVIRONMENTS as readonly string[]).includes(mode ?? "");
}

/** Reads the committed, non-secret values of an environment. */
export function readEnvironmentFile(environment: DeployEnvironment, root = process.cwd()): Record<string, string> {
  const file = `${root}/.env.${environment}`;
  if (!existsSync(file)) throw new Error(`Missing ${file} (docs/environments.md).`);
  return parse(readFileSync(file));
}

function notificationsEnabled(): boolean {
  return process.env.OPENSPOT_NOTIFICATIONS === "1";
}

function compatibility() {
  return { compatibilityDate: "2026-10-30", compatibilityFlags: ["nodejs_compat"] };
}

/**
 * The response-store Worker for a mode. vite.config.ts loads it as an
 * auxiliary Worker; the application Worker binds to it.
 */
export async function responseStoreFor(mode: string | undefined) {
  const shape = isDeployEnvironment(mode) ? ENVIRONMENTS[mode] : ENVIRONMENTS.develop;
  return createWorkersResponseStoreServiceBindingConfig({
    worker: { name: shape.responseStore.worker, ...compatibility() },
    bucket: shape.responseStore.bucket,
  });
}

function secretsFor(names: readonly string[]) {
  return Object.fromEntries(names.map((name) => [name, bindings.secret()]));
}

function deployVariables(environment: DeployEnvironment) {
  const values = readEnvironmentFile(environment);
  const missing = RUNTIME_VARIABLE_NAMES.filter((name) => !values[name]);
  const unset = Object.entries(values)
    .filter(([, value]) => value.includes(PLACEHOLDER))
    .map(([name]) => name);
  if (missing.length > 0 || unset.length > 0) {
    throw new Error(
      `.env.${environment} is incomplete.` +
        (missing.length ? ` Missing: ${missing.join(", ")}.` : "") +
        (unset.length ? ` Still ${PLACEHOLDER}: ${unset.join(", ")}.` : ""),
    );
  }
  return Object.fromEntries(
    Object.entries({ ...values, APP_ENV: environment, NEXT_PUBLIC_APP_ENV: environment }).map(([name, value]) => [
      name,
      bindings.text(value),
    ]),
  );
}

export default defineConfig(async ({ mode }) => {
  const deploy = isDeployEnvironment(mode) ? mode : null;
  if (!deploy && mode !== "development") {
    throw new Error(`Unknown build mode "${mode}". Use pnpm build:develop or pnpm build:production.`);
  }
  const shape = ENVIRONMENTS[deploy ?? "develop"];
  if (!shape.hyperdriveId) {
    throw new Error(
      `ENVIRONMENTS.${deploy}.hyperdriveId is empty. Create the Hyperdrive config first (docs/environments.md).`,
    );
  }

  const notificationSecrets = notificationsEnabled() ? NOTIFICATION_SECRET_NAMES : [];
  // `vite dev` keeps reading everything from .env.local, as before.
  const env = deploy
    ? { ...deployVariables(deploy), ...secretsFor([...SECRET_NAMES, ...notificationSecrets]) }
    : secretsFor([...SECRET_NAMES, ...RUNTIME_VARIABLE_NAMES, ...notificationSecrets]);

  const responseStore = await responseStoreFor(mode);

  return {
    worker: defineWorker({
      ...responseStore.applicationWorker,
      name: deploy ? shape.worker : "open-spot",
      entrypoint: "./src/worker.ts",
      ...compatibility(),
      ...(deploy && shape.domains.length > 0 ? { domains: shape.domains } : {}),
      assets: {
        htmlHandling: "none",
        notFoundHandling: "none",
        // Every request that runs this Worker counts against the plan's daily
        // request quota. Files from public/ are served by Static Assets without
        // running the Worker (free and unmetered). A path with no matching asset
        // still falls through to the Worker, so generated routes like
        // opengraph-image work.
        runWorkerFirst: [
          "/*",
          "!/_next/static/*",
          "!/*/_next/static/*",
          "!/favicon.ico",
          "!/*.png",
          "!/*.jpg",
          "!/*.jpeg",
          "!/*.gif",
          "!/*.webp",
          "!/*.svg",
          "!/og/*",
        ],
      },
      env: {
        ...responseStore.applicationWorker.env,
        ...env,
        ASSETS: bindings.assets(),
        HYPERDRIVE: bindings.hyperdrive({ id: shape.hyperdriveId }),
      },
    }),
  };
});
