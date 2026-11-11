import { describe, expect, it } from "vitest"
import { checkMigrationChanges, parseNameStatus } from "./migration-rules"

const base = ["0000_baseline.sql", "0010_event_signal_trigger_deferred.sql", "0011_notification_email_budget.sql"]

describe("parseNameStatus", () => {
  it("reads adds, edits and renames", () => {
    expect(
      parseNameStatus(
        "A\tsupabase/migrations/0012_x.sql\nM\tsrc/a.ts\nR100\tsupabase/migrations/0001_a.sql\tsupabase/migrations/0001_b.sql\n",
      ),
    ).toEqual([
      { status: "A", path: "supabase/migrations/0012_x.sql" },
      { status: "M", path: "src/a.ts" },
      { status: "R", path: "supabase/migrations/0001_b.sql", from: "supabase/migrations/0001_a.sql" },
    ])
  })
})

describe("checkMigrationChanges", () => {
  it("accepts the next numbered file and ignores other paths", () => {
    const changes = parseNameStatus("A\tsupabase/migrations/0012_feature_flags.sql\nM\tsrc/db/seed.ts")
    expect(checkMigrationChanges(changes, base)).toEqual([])
  })

  it("accepts several consecutive files", () => {
    const changes = parseNameStatus(
      "A\tsupabase/migrations/0013_b.sql\nA\tsupabase/migrations/0012_a.sql",
    )
    expect(checkMigrationChanges(changes, base)).toEqual([])
  })

  it("rejects edits, deletions and renames of existing files", () => {
    const changes = parseNameStatus(
      [
        "M\tsupabase/migrations/0011_notification_email_budget.sql",
        "D\tsupabase/migrations/0010_event_signal_trigger_deferred.sql",
        "R090\tsupabase/migrations/0000_baseline.sql\tsupabase/migrations/0000_base.sql",
      ].join("\n"),
    )
    const problems = checkMigrationChanges(changes, base)
    expect(problems).toHaveLength(3)
    expect(problems[0]).toMatch(/0011_notification_email_budget\.sql was edited/)
    expect(problems[1]).toMatch(/was deleted/)
    expect(problems[2]).toMatch(/0000_baseline\.sql was renamed/)
  })

  it("rejects a gap or a reused number", () => {
    expect(checkMigrationChanges(parseNameStatus("A\tsupabase/migrations/0014_x.sql"), base)[0]).toMatch(
      /expected number 0012/,
    )
    expect(checkMigrationChanges(parseNameStatus("A\tsupabase/migrations/0011_dup.sql"), base)[0]).toMatch(
      /expected number 0012/,
    )
  })

  it("rejects badly named files", () => {
    expect(checkMigrationChanges(parseNameStatus("A\tsupabase/migrations/12_Bad.sql"), base)[0]).toMatch(
      /NNNN_snake_case/,
    )
  })

  it("does not police the meta folder or the archive", () => {
    const changes = parseNameStatus(
      "M\tsupabase/migrations/meta/_journal.json\nM\tsupabase/migrations_archive/0001_old.sql",
    )
    expect(checkMigrationChanges(changes, base)).toEqual([])
  })
})
