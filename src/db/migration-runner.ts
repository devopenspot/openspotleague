import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

export type MigrationFile = {
  file: string
  id: string
  /** Canonical content hash (`v2:<sha256>` over normalized statements). */
  hash: string
  /** Raw-bytes hash, kept only to verify pre-v2 ledger rows for rebaseline. */
  legacyHash: string
  statements: readonly string[]
  groups: readonly StatementGroup[]
}

/** Raw-bytes sha256. Legacy format — only used to verify untouched pre-v2 files. */
export function hashFileContent(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

const DOLLAR_QUOTE_OPEN = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char)
}

/**
 * Strip `--` line comments and nested slash-star block comments.
 * String literals (`'…'`, `"…"`, `E'…'`, `$tag$…$tag$`) are passed through
 * untouched so comment-looking text inside them survives. A naive regex
 * would eat `--` inside PL/pgSQL bodies — hence the scanner.
 */
export function stripSqlComments(sql: string): string {
  let out = ""
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i + 2)
      out += "\n"
      i = end === -1 ? n : end + 1
      continue
    }

    if (ch === "/" && next === "*") {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth += 1
          i += 2
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth -= 1
          i += 2
        } else {
          i += 1
        }
      }
      out += " "
      continue
    }

    if (ch === "'" || ch === `"`) {
      const quote = ch
      const isEscapeString =
        quote === "'" &&
        (sql[i - 1] === "e" || sql[i - 1] === "E") &&
        !isIdentifierChar(sql[i - 2])
      const start = i
      i += 1
      while (i < n) {
        if (isEscapeString && sql[i] === "\\") {
          i += 2
          continue
        }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            i += 2
            continue
          }
          i += 1
          break
        }
        i += 1
      }
      out += sql.slice(start, i)
      continue
    }

    if (ch === "$") {
      const open = DOLLAR_QUOTE_OPEN.exec(sql.slice(i))
      if (open) {
        const tag = open[0]
        const close = sql.indexOf(tag, i + tag.length)
        const end = close === -1 ? n : close + tag.length
        out += sql.slice(i, end)
        i = end
        continue
      }
      out += ch
      i += 1
      continue
    }

    out += ch
    i += 1
  }
  return out
}

/** Comment-insensitive, whitespace-collapsed form. Case preserved (quoted identifiers). */
export function normalizeMigrationStatement(statement: string): string {
  return stripSqlComments(statement).replace(/\s+/g, " ").trim()
}

/**
 * Canonical content hash. Order-sensitive (reordered DDL still counts as
 * drift) but immune to comment, whitespace, and breakpoint-line edits.
 */
export function hashMigrationStatements(statements: readonly string[]): string {
  const canonical = statements
    .map(normalizeMigrationStatement)
    .filter(Boolean)
    .join("\n")
  return `v2:${createHash("sha256").update(canonical).digest("hex")}`
}

export function sortMigrationFiles(files: readonly string[]): string[] {
  return files
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
}

export function parseMigrationStatements(body: string): string[] {
  return body
    .split(/^[ \t]*--> statement-breakpoint[ \t]*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^[ \t]*-->[ \t]*tx-(begin|commit)[ \t]*$/.test(statement))
}

export interface StatementGroup {
  statements: string[]
  /** Run inside one transaction; deferred triggers only see the tx-end state. */
  readonly transactional: boolean
}

const TX_BEGIN = /^[ \t]*-->[ \t]*tx-begin[ \t]*$/
const TX_COMMIT = /^[ \t]*-->[ \t]*tx-commit[ \t]*$/

/**
 * Split a migration body into statement groups. Regular statements stay
 * non-transactional (per-statement autocommit); files that need atomic data
 * loads (deferred triggers → multi-statement invariant) mark ranges with
 * `--> tx-begin` / `--> tx-commit`.
 */
export function parseStatementGroups(body: string): readonly StatementGroup[] {
  const segments = body.split(/^[ \t]*--> statement-breakpoint[ \t]*$/m)
  const groups: StatementGroup[] = []
  let current: StatementGroup | null = null

  const pushContent = (content: string): void => {
    if (!content) return
    if (current !== null) current.statements.push(content)
    else groups.push({ statements: [content], transactional: false })
  }

  for (const segment of segments) {
    const contentLines: string[] = []
    for (const line of segment.split("\n")) {
      const trimmed = line.trim()
      if (TX_BEGIN.test(trimmed)) {
        pushContent(contentLines.join("\n").trim())
        contentLines.length = 0
        current = { statements: [], transactional: true }
        continue
      }
      if (TX_COMMIT.test(trimmed)) {
        pushContent(contentLines.join("\n").trim())
        contentLines.length = 0
        if (current === null) throw new Error(`--> tx-commit without a matching --> tx-begin`)
        groups.push(current)
        current = null
        continue
      }
      contentLines.push(line)
    }
    pushContent(contentLines.join("\n").trim())
  }
  if (current !== null) {
    throw new Error(`--> tx-begin without a matching --> tx-commit`)
  }
  return groups
}

export function loadMigrationFiles(migrationsDir: string): MigrationFile[] {
  return sortMigrationFiles(readdirSync(migrationsDir)).map((file) => {
    const full = path.join(migrationsDir, file)
    const content = readFileSync(full, "utf8")
    const statements = parseMigrationStatements(content)
    return {
      file,
      id: path.basename(file, ".sql"),
      hash: hashMigrationStatements(statements),
      legacyHash: hashFileContent(content),
      statements,
      groups: parseStatementGroups(content),
    }
  })
}

export function pendingMigrationFiles(
  migrations: readonly MigrationFile[],
  appliedIds: ReadonlySet<string>,
): MigrationFile[] {
  return migrations.filter((migration) => !appliedIds.has(migration.id))
}

/**
 * Rows whose stored hash predates v2 but provably matches the current file
 * (or rows that predate hash tracking entirely). Safe to re-record with the
 * v2 hash — no DDL has changed since they were applied.
 */
export function pendingHashRebaselines(
  migrations: readonly MigrationFile[],
  applied: ReadonlyMap<string, string | null>,
): MigrationFile[] {
  return migrations.filter((migration) => {
    if (!applied.has(migration.id)) return false
    const prev = applied.get(migration.id)
    if (prev == null) return true
    return prev !== migration.hash && prev === migration.legacyHash
  })
}

export function detectMigrationDrift(
  migrations: readonly MigrationFile[],
  applied: ReadonlyMap<string, string | null>,
): void {
  for (const m of migrations) {
    const prev = applied.get(m.id)
    if (prev == null || prev === m.hash || prev === m.legacyHash) continue
    throw new Error(
      `Migration drift detected: ${m.file} content changed since it was applied — ` +
        `write a follow-up migration instead of editing an applied file`,
    )
  }
}
