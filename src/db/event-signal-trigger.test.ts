import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { loadMigrationFiles } from "./migration-runner"

/**
 * Guards 0009: the sport_events signal trigger must fire at commit (deferred)
 * so the League service's specific `signal_type` row wins the unique
 * (event_id, version) slot instead of the trigger's generic one.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations")
const TRIGGER = `"sport_events_realtime_signal_trigger"`

function squash(sql: string): string {
  return sql.replace(/\s+/g, " ").trim()
}

const migrations = loadMigrationFiles(MIGRATIONS_DIR)
const fix = migrations.find((migration) => migration.id === "0010_event_signal_trigger_deferred")

describe("0010 deferred event signal trigger", () => {
  it("exists", () => {
    expect(fix).toBeDefined()
  })

  it("swaps the trigger in one transaction as a deferred constraint trigger", () => {
    const swap = fix!.groups.find((group) => group.statements.some((s) => s.includes(TRIGGER)))
    expect(swap?.transactional).toBe(true)
    const statements = swap!.statements.map(squash)
    expect(statements[0]).toMatch(/^DROP TRIGGER IF EXISTS "sport_events_realtime_signal_trigger" ON "sport_events";?$/)
    expect(statements[1]).toContain(`CREATE CONSTRAINT TRIGGER ${TRIGGER}`)
    expect(statements[1]).toContain("AFTER UPDATE OF version ON \"sport_events\"")
    expect(statements[1]).toContain("DEFERRABLE INITIALLY DEFERRED")
  })

  it("keeps the generic row as a gap filler that survives a later delete", () => {
    const fn = squash(fix!.statements.find((s) => s.includes("FUNCTION public.emit_event_realtime_signal"))!)
    expect(fn).toContain("ON CONFLICT (event_id, version) DO NOTHING")
    expect(fn).toContain("WHERE EXISTS (SELECT 1 FROM public.sport_events WHERE id = NEW.id)")
  })

  it("is not undone by a later migration", () => {
    const later = migrations.filter((migration) => migration.id > fix!.id)
    for (const migration of later) {
      for (const statement of migration.statements) {
        expect(squash(statement), migration.file).not.toMatch(
          new RegExp(`CREATE TRIGGER ${TRIGGER}`),
        )
      }
    }
  })

  it("matches the trigger the baseline builder emits (drift guard)", () => {
    const builder = squash(readFileSync(path.join(process.cwd(), "scripts", "build-fresh-baseline.ts"), "utf8"))
    expect(builder).toContain(
      squash(`CREATE CONSTRAINT TRIGGER ${TRIGGER}
AFTER UPDATE OF version ON "sport_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.emit_event_realtime_signal();`),
    )
    expect(builder).toContain("WHERE EXISTS (SELECT 1 FROM public.sport_events WHERE id = NEW.id)")
  })
})
