import type { Config } from "drizzle-kit"

const firstConfigured = (...values: Array<string | undefined>) =>
  values.map((value) => value?.trim()).find(Boolean)

if (process.env.DB_CONNETION_STRING) {
  throw new Error(
    "drizzle.config.ts: DB_CONNETION_STRING is removed (typo). Use SUPABASE_DIRECT_URL or DB_CONNECTION_STRING.",
  )
}
const url = firstConfigured(
  process.env.SUPABASE_DIRECT_URL,
  process.env.DB_CONNECTION_STRING,
  process.env.DATABASE_URL,
)

if (!url) {
  throw new Error(
    "drizzle.config.ts: set SUPABASE_DIRECT_URL (preferred), DB_CONNECTION_STRING, or DATABASE_URL before running drizzle-kit.",
  )
}

export default {
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config
