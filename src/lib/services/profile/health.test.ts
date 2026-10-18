import path from "node:path"
import { readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  FALLBACK_EXPECTED_MIGRATION_ID,
  getExpectedMigrationId,
  parsePostgresDurationMs,
} from "./health"

describe("database health diagnostics", () => {
  it("parses PostgreSQL timeout units", () => {
    expect(parsePostgresDurationMs("8s")).toBe(8_000)
    expect(parsePostgresDurationMs("8000ms")).toBe(8_000)
    expect(parsePostgresDurationMs("2min")).toBe(120_000)
    expect(parsePostgresDurationMs("8000")).toBe(8_000)
    expect(parsePostgresDurationMs("disabled")).toBeNull()
  })

  it("resolves expected migration id from filesystem tip with fallback", () => {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations")
    const latest = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => path.basename(f, ".sql"))
      .sort((a, b) => a.localeCompare(b))
      .at(-1)

    expect(latest).toBeDefined()
    expect(getExpectedMigrationId()).toBe(latest)
    expect(FALLBACK_EXPECTED_MIGRATION_ID).toBe(latest)
  })
})
