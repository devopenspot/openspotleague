import type { AppEnvironment } from "@/lib/config/env"

/**
 * Client-safe environment name, inlined at build time by `pnpm build:<env>`
 * (docs/environments.md). Server code should read `env.APP_ENV` instead.
 */
export const PUBLIC_APP_ENV: AppEnvironment =
  process.env.NEXT_PUBLIC_APP_ENV === "develop" || process.env.NEXT_PUBLIC_APP_ENV === "production"
    ? process.env.NEXT_PUBLIC_APP_ENV
    : "local"
