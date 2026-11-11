/**
 * Which Supabase project a CLI script is about to touch, and whether it may.
 * See docs/environments.md → Guards.
 *
 * The target is detected from the project ref inside the connection URLs, not
 * from a label someone could forget to change. Project refs are public (they
 * are in every browser request), so they live here.
 */

export const PROJECT_REFS = {
  develop: "vvmfgkphetdfyhnrrwar",
  production: "pvnchrcczjnoubymrvzz",
} as const

export type DeployedEnvironment = keyof typeof PROJECT_REFS
export type TargetEnvironment = DeployedEnvironment | "unknown"

/**
 * - `read`: diagnostics. Always allowed.
 * - `write`: migrations, seeds, admin grants. Production only from CI or with
 *   OPENSPOT_CONFIRM_PRODUCTION=1.
 * - `destructive`: reset, fresh, storage deletes. Never on production.
 */
export type TargetOperation = "read" | "write" | "destructive"

/** Env variables that name a Supabase project, in the order they are reported. */
const TARGET_VARIABLES = [
  "SUPABASE_DIRECT_URL",
  "SUPABASE_DATABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const

export interface DbTarget {
  environment: TargetEnvironment
  /** The project ref, when one was found. */
  ref: string | null
  /** Host of the database connection, for the banner (never the password). */
  host: string | null
}

export class TargetGuardError extends Error {
  override name = "TargetGuardError"
}

/**
 * Extracts the project ref from any Supabase URL form:
 * `db.<ref>.supabase.co`, `postgres.<ref>@…pooler.supabase.com`, `https://<ref>.supabase.co`.
 */
export function projectRefFromUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const user = decodeURIComponent(url.username).toLowerCase()
  const poolerUser = /^postgres\.([a-z0-9]{20})$/.exec(user)
  if (poolerUser && host.endsWith(".pooler.supabase.com")) return poolerUser[1] ?? null
  const projectHost = /^(?:db\.)?([a-z0-9]{20})\.supabase\.co$/.exec(host)
  return projectHost?.[1] ?? null
}

function environmentForRef(ref: string): TargetEnvironment {
  for (const [environment, known] of Object.entries(PROJECT_REFS)) {
    if (known === ref) return environment as DeployedEnvironment
  }
  return "unknown"
}

function hostOf(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  try {
    return new URL(raw.trim()).host
  } catch {
    return null
  }
}

/** Detects the target from the loaded env. Throws if the variables disagree. */
export function detectTarget(source: Record<string, string | undefined>): DbTarget {
  const refs = new Map<string, string[]>()
  for (const name of TARGET_VARIABLES) {
    const ref = projectRefFromUrl(source[name])
    if (ref) refs.set(ref, [...(refs.get(ref) ?? []), name])
  }
  if (refs.size > 1) {
    const detail = [...refs.entries()]
      .map(([ref, names]) => `${ref} (${environmentForRef(ref)}) in ${names.join(", ")}`)
      .join("; ")
    throw new TargetGuardError(`The env mixes Supabase projects: ${detail}. Fix the env file before running anything.`)
  }
  const ref = refs.keys().next().value ?? null
  return {
    environment: ref ? environmentForRef(ref) : "unknown",
    ref,
    host: hostOf(source.SUPABASE_DIRECT_URL) ?? hostOf(source.SUPABASE_DATABASE_URL) ?? hostOf(source.SUPABASE_URL),
  }
}

export interface GuardInput {
  target: DbTarget
  operation: TargetOperation
  /** OPENSPOT_ENV, when the caller named an environment. */
  requested?: string
  /** True inside GitHub Actions (CI=true). */
  ci: boolean
  /** OPENSPOT_CONFIRM_PRODUCTION=1. */
  confirmed: boolean
}

/** Throws a TargetGuardError when the operation may not run on the target. */
export function assertTargetAllowed({ target, operation, requested, ci, confirmed }: GuardInput): void {
  if (requested && requested !== "local") {
    if (!(requested in PROJECT_REFS)) {
      throw new TargetGuardError(`OPENSPOT_ENV must be develop or production, got "${requested}".`)
    }
    if (target.environment !== requested) {
      throw new TargetGuardError(
        `OPENSPOT_ENV=${requested}, but the connection points at ${target.environment}` +
          (target.ref ? ` (ref ${target.ref})` : "") +
          ". Stopping.",
      )
    }
  }
  if (target.environment !== "production") return
  if (operation === "destructive") {
    throw new TargetGuardError(
      "Refusing a destructive operation on the production project. It is never allowed (docs/environments.md → Guards).",
    )
  }
  if (operation === "write" && !ci && !confirmed) {
    throw new TargetGuardError(
      "This writes to the production project. Run it from the Database task workflow, " +
        "or set OPENSPOT_CONFIRM_PRODUCTION=1 for a break-glass run.",
    )
  }
}

export function describeTarget(target: DbTarget): string {
  const parts = [target.host, target.ref ? `ref ${target.ref}` : null].filter(Boolean)
  return `db target: ${target.environment}${parts.length ? ` (${parts.join(", ")})` : ""}`
}

/**
 * For CLI scripts: prints the target and exits with code 1 when the operation
 * is not allowed. Call it after `import "./load-env"` and before connecting.
 */
let guarded: { operation: TargetOperation; target: DbTarget } | null = null

const SEVERITY: Record<TargetOperation, number> = { read: 0, write: 1, destructive: 2 }

export function guardDbScript(operation: TargetOperation, source: NodeJS.ProcessEnv = process.env): DbTarget {
  // A script that imports another script (seed → seed-tv) is checked once,
  // unless the second check asks for more.
  if (guarded && SEVERITY[guarded.operation] >= SEVERITY[operation]) return guarded.target
  try {
    const target = detectTarget(source)
    console.log(describeTarget(target))
    assertTargetAllowed({
      target,
      operation,
      requested: source.OPENSPOT_ENV?.trim() || undefined,
      ci: source.CI === "true",
      confirmed: source.OPENSPOT_CONFIRM_PRODUCTION === "1",
    })
    guarded = { operation, target }
    return target
  } catch (error) {
    if (error instanceof TargetGuardError) {
      console.error(`✗ ${error.message}`)
      process.exit(1)
    }
    throw error
  }
}
