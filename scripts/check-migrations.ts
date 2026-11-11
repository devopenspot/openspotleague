/**
 * pnpm db:check-migrations <base-sha>
 *
 * CI check (docs/ci-cd.md §8): compares supabase/migrations against the base
 * commit and fails when an existing file was edited, renamed or deleted, or a
 * new file skips or reuses a number. Read-only; no database.
 */
import { execFileSync } from "node:child_process"
import { MIGRATIONS_PATH, checkMigrationChanges, parseNameStatus } from "@/db/migration-rules"

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" })
}

const base = process.argv[2]?.trim()
if (!base || /^0+$/.test(base)) {
  console.log("check-migrations: no base commit (new branch or first push); nothing to compare.")
  process.exit(0)
}
try {
  git("cat-file", "-e", `${base}^{commit}`)
} catch {
  console.error(`check-migrations: base commit ${base} is not available. Fetch with full history (fetch-depth: 0).`)
  process.exit(2)
}

const changes = parseNameStatus(git("diff", "--name-status", "-M", base, "HEAD", "--", MIGRATIONS_PATH))
const baseFiles = git("ls-tree", "--name-only", `${base}:${MIGRATIONS_PATH}`)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)

const problems = checkMigrationChanges(changes, baseFiles)
if (problems.length > 0) {
  console.error("Migration rules failed:\n" + problems.map((p) => `  ✗ ${p}`).join("\n"))
  process.exit(1)
}
const added = changes.filter((c) => c.status === "A").length
console.log(`✓ migrations: ${added} new file(s), no applied file changed`)
