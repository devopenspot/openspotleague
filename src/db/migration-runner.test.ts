import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  detectMigrationDrift,
  hashFileContent,
  hashMigrationStatements,
  normalizeMigrationStatement,
  parseMigrationStatements,
  parseStatementGroups,
  pendingHashRebaselines,
  pendingMigrationFiles,
  sortMigrationFiles,
  stripSqlComments,
  loadMigrationFiles,
  type MigrationFile,
} from "./migration-runner"

function migrationFile(overrides: Partial<MigrationFile> = {}): MigrationFile {
  return {
    file: "0001_follow_up.sql",
    id: "0001_follow_up",
    hash: "v2:abc",
    legacyHash: "raw",
    statements: [],
    groups: [],
    ...overrides,
  }
}

describe("migration runner helpers", () => {
  it("sorts SQL migrations and ignores non-SQL files", () => {
    expect(
      sortMigrationFiles([
        "README.md",
        "0002_add_index.sql",
        "0000_baseline.sql",
        "0001_follow_up.sql",
      ]),
    ).toEqual([
      "0000_baseline.sql",
      "0001_follow_up.sql",
      "0002_add_index.sql",
    ])
  })

  it("splits migration statements at explicit breakpoints", () => {
    expect(
      parseMigrationStatements(
        "  create table one (id int);\n--> statement-breakpoint\n\n alter table one add column name text; ",
      ),
    ).toEqual([
      "create table one (id int);",
      "alter table one add column name text;",
    ])
  })

  it("returns only migrations missing from the ledger", () => {
    const migrations: MigrationFile[] = [
      migrationFile({ file: "0000_baseline.sql", id: "0000_baseline", hash: "v2:a", legacyHash: "a" }),
      migrationFile({ file: "0001_follow_up.sql", id: "0001_follow_up", hash: "v2:b", legacyHash: "b" }),
    ]

    expect(
      pendingMigrationFiles(migrations, new Set(["0000_baseline"])).map(
        (migration) => migration.id,
      ),
    ).toEqual(["0001_follow_up"])
    expect(pendingMigrationFiles(migrations, new Set(migrations.map((migration) => migration.id)))).toEqual([])
  })

  it("registers the squashed baseline containing curator management", () => {
    const migrations = loadMigrationFiles(
      path.resolve(process.cwd(), "supabase/migrations"),
    )
    const migration = migrations.find((item) => item.id === "0000_baseline")

    expect(migration).toBeDefined()
    expect(migration?.statements).toEqual(
      expect.arrayContaining([
        expect.stringContaining("CREATE TABLE \"content_audit_log\""),
        expect.stringContaining("CREATE TABLE \"curator_country_scopes\""),
        expect.stringContaining("CREATE CONSTRAINT TRIGGER spots_require_discipline"),
      ]),
    )
  })
})

describe("stripSqlComments", () => {
  it("removes line and block comments", () => {
    expect(
      stripSqlComments(
        "-- header\nalter table one add column a text; -- trailing\n/* block */select 1;",
      ),
    ).toBe("\nalter table one add column a text; \n select 1;")
  })

  it("removes nested block comments", () => {
    expect(stripSqlComments("select /* outer /* inner */ still */ 1;")).toBe(
      "select   1;",
    )
  })

  it("preserves comment-looking text inside string literals", () => {
    const sql = "insert into t (note) values ('-- not a comment /* either */');"
    expect(stripSqlComments(sql)).toBe(sql)
  })

  it("preserves doubled quotes and double-quoted identifiers", () => {
    const sql = `insert into t (note) values ('it''s -- fine'); alter table "we--ird" add column a text;`
    expect(stripSqlComments(sql)).toBe(sql)
  })

  it("preserves dollar-quoted bodies but strips outside them", () => {
    const sql =
      "do $$ begin -- inside\nraise notice '/* inside */'; end $$; -- outside"
    expect(stripSqlComments(sql)).toBe(
      "do $$ begin -- inside\nraise notice '/* inside */'; end $$; \n",
    )
  })

  it("supports tagged dollar quotes and ignores positional params", () => {
    const tagged = "do $body$ begin /* kept */ end $body$; -- gone"
    expect(stripSqlComments(tagged)).toBe(
      "do $body$ begin /* kept */ end $body$; \n",
    )
    const params = "select $1, $2; -- gone"
    expect(stripSqlComments(params)).toBe("select $1, $2; \n")
  })

  it("handles backslash escapes in E-strings", () => {
    const sql = `insert into t (note) values (E'it\\'s -- kept'); -- gone`
    expect(stripSqlComments(sql)).toBe(
      `insert into t (note) values (E'it\\'s -- kept'); \n`,
    )
  })
})

describe("parseStatementGroups", () => {
  it("keeps plain statements non-transactional", () => {
    const groups = parseStatementGroups("select 1;\n--> statement-breakpoint\nselect 2;")
    expect(groups).toEqual([
      { statements: ["select 1;"], transactional: false },
      { statements: ["select 2;"], transactional: false },
    ])
  })

  it("wraps tx-marker ranges into a single transactional group", () => {
    const body = "insert a;\n--> statement-breakpoint\n--> tx-begin\ninsert b;\n--> statement-breakpoint\ninsert c;\n--> statement-breakpoint\n--> tx-commit\n"
    const groups = parseStatementGroups(body)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({ statements: ["insert a;"], transactional: false })
    expect(groups[1]).toEqual({ statements: ["insert b;", "insert c;"], transactional: true })
  })

  it("strips tx markers from statements so hashes stay content-based", () => {
    const withMarkers = "insert a;\n--> statement-breakpoint\n--> tx-begin\ninsert b;\n--> statement-breakpoint\n--> tx-commit\n"
    const withoutMarkers = "insert a;\n--> statement-breakpoint\ninsert b;\n"
    expect(hashMigrationStatements(parseMigrationStatements(withMarkers))).toBe(
      hashMigrationStatements(parseMigrationStatements(withoutMarkers)),
    )
    expect(normalizeMigrationStatement(parseMigrationStatements(withMarkers)[1]!)).toBe("insert b;")
  })

  it("rejects unbalanced tx markers", () => {
    expect(() => parseStatementGroups("--> tx-commit")).toThrow()
    expect(() => parseStatementGroups("--> tx-begin\nselect 1;")).toThrow()
  })
})

describe("hashMigrationStatements", () => {
  const statements = [
    "alter table one add column a text;",
    "do $$ begin raise notice 'hi'; end $$;",
  ]

  it("is immune to comment, whitespace, and breakpoint edits", () => {
    const edited = [
      "-- a header comment\n  alter   table one\nadd column a text; -- trailing",
      "/* block */ do $$ begin raise notice 'hi'; end $$;",
    ]
    expect(hashMigrationStatements(edited)).toBe(
      hashMigrationStatements(statements),
    )
    expect(hashMigrationStatements(statements)).toMatch(/^v2:[0-9a-f]{64}$/)
  })

  it("changes on semantic edits and reorder", () => {
    expect(
      hashMigrationStatements([...statements, "select 1;"]),
    ).not.toBe(hashMigrationStatements(statements))
    expect(
      hashMigrationStatements(
        statements.map((s) => s.replace("column a", "column b")),
      ),
    ).not.toBe(hashMigrationStatements(statements))
    expect(hashMigrationStatements([...statements].reverse())).not.toBe(
      hashMigrationStatements(statements),
    )
  })

  it("ignores empty statements after normalization", () => {
    expect(hashMigrationStatements([...statements, "-- only a comment"])).toBe(
      hashMigrationStatements(statements),
    )
  })
})

describe("normalizeMigrationStatement", () => {
  it("collapses whitespace and preserves case", () => {
    expect(
      normalizeMigrationStatement('  alter\n\ttable "Mixed" \n add column a text; '),
    ).toBe('alter table "Mixed" add column a text;')
  })
})

describe("drift and rebaseline classification", () => {
  const file = migrationFile({
    hash: "v2:current",
    legacyHash: "raw-bytes",
  })

  it("passes verified and provably-untouched legacy rows", () => {
    expect(() =>
      detectMigrationDrift(
        [file],
        new Map([["0001_follow_up", "v2:current"]]),
      ),
    ).not.toThrow()
    expect(() =>
      detectMigrationDrift([file], new Map([["0001_follow_up", "raw-bytes"]])),
    ).not.toThrow()
    expect(() =>
      detectMigrationDrift([file], new Map([["0001_follow_up", null]])),
    ).not.toThrow()
  })

  it("throws on genuine drift with a follow-up hint", () => {
    expect(() =>
      detectMigrationDrift([file], new Map([["0001_follow_up", "other"]])),
    ).toThrow(/follow-up migration/)
  })

  it("selects only rebaselinable rows", () => {
    const untouched = migrationFile({
      id: "a",
      file: "a.sql",
      hash: "v2:a",
      legacyHash: "raw-a",
    })
    const current = migrationFile({
      id: "b",
      file: "b.sql",
      hash: "v2:b",
      legacyHash: "raw-b",
    })
    const ancient = migrationFile({
      id: "c",
      file: "c.sql",
      hash: "v2:c",
      legacyHash: "raw-c",
    })
    const drifted = migrationFile({
      id: "d",
      file: "d.sql",
      hash: "v2:d",
      legacyHash: "raw-d",
    })
    const pending = migrationFile({ id: "e", file: "e.sql" })
    const applied = new Map<string, string | null>([
      ["a", "raw-a"],
      ["b", "v2:b"],
      ["c", null],
      ["d", "something-else"],
    ])

    expect(
      pendingHashRebaselines(
        [untouched, current, ancient, drifted, pending],
        applied,
      ).map((m) => m.id),
    ).toEqual(["a", "c"])
  })

  it("hashFileContent still matches the legacy ledger format", () => {
    expect(hashFileContent("select 1;")).toMatch(/^[0-9a-f]{64}$/)
  })
})
