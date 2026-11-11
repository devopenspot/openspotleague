/**
 * CI rules for supabase/migrations (docs/ci-cd.md §8): applied migrations are
 * immutable, so a change may only add new files, and each new file takes the
 * next number after the highest one on the base branch. Pure: the CLI
 * (scripts/check-migrations.ts) feeds it `git diff --name-status` output.
 */

export const MIGRATIONS_PATH = "supabase/migrations/"

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/

export interface MigrationChange {
  /** git status letter: A, M, D, R, C, T. */
  status: string
  path: string
  /** Old path for renames and copies. */
  from?: string
}

/** Parses `git diff --name-status` lines (tab-separated). */
export function parseNameStatus(output: string): MigrationChange[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawStatus = "", first = "", second] = line.split("\t")
      const status = rawStatus.charAt(0)
      return second ? { status, path: second, from: first } : { status, path: first }
    })
}

function isMigrationSql(path: string): boolean {
  return path.startsWith(MIGRATIONS_PATH) && !path.slice(MIGRATIONS_PATH.length).includes("/") && path.endsWith(".sql")
}

function migrationNumber(fileName: string): number | null {
  const match = MIGRATION_FILE.exec(fileName)
  return match ? Number(match[1]) : null
}

/**
 * Returns the rule violations, empty when the change is fine.
 * `baseFiles` are the migration file names (not paths) on the base commit.
 */
export function checkMigrationChanges(
  changes: readonly MigrationChange[],
  baseFiles: readonly string[],
): string[] {
  const problems: string[] = []
  const added: string[] = []

  for (const change of changes) {
    const touched = [change.path, change.from].filter((p): p is string => Boolean(p))
    if (!touched.some(isMigrationSql)) continue
    if (change.status === "A") {
      added.push(change.path.slice(MIGRATIONS_PATH.length))
    } else {
      const verb = { M: "edited", D: "deleted", R: "renamed", C: "copied", T: "changed" }[change.status] ?? "changed"
      problems.push(
        `${change.from ?? change.path} was ${verb}. Applied migrations are immutable: ship the fix as a new numbered file.`,
      )
    }
  }

  const baseNumbers = baseFiles.map(migrationNumber).filter((n): n is number => n !== null)
  let next = (baseNumbers.length > 0 ? Math.max(...baseNumbers) : -1) + 1

  for (const file of [...added].sort()) {
    const number = migrationNumber(file)
    if (number === null) {
      problems.push(`${file}: name it NNNN_snake_case.sql (four digits, lowercase).`)
      continue
    }
    const expected = String(next).padStart(4, "0")
    if (number !== next) {
      problems.push(
        `${file}: expected number ${expected}. Rebase on main and renumber if someone merged a migration first.`,
      )
    }
    next = Math.max(next, number) + 1
  }

  return problems
}
