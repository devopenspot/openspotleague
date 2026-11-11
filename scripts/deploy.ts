/**
 * pnpm deploy:develop | pnpm deploy:production [cf deploy args, e.g. --dry-run]
 *
 * Deploys the build made by `pnpm build:<env>`: first the response-store
 * Worker, then the application Worker with its declared secrets. Normally run
 * by the workflows (docs/ci-cd.md); from a laptop only as a break-glass
 * action (docs/environments.md).
 *
 * Secret values come from the process environment (GitHub environment
 * secrets in CI) or, locally, from `.env.<env>.local`. Never from
 * `.env.local`, which holds develop values. Only the names declared in
 * cloudflare.config.ts are written to the temporary secrets file, so nothing
 * else (CLOUDFLARE_API_TOKEN, pooler URLs) can reach the Worker.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parse } from "dotenv"
import { ENVIRONMENTS, isDeployEnvironment, type DeployEnvironment } from "../cloudflare.config"

const OUTPUT = ".cloudflare/output/v0"

const requested = process.argv[2]
const extraArgs = process.argv.slice(3)
if (!isDeployEnvironment(requested)) {
  console.error("Usage: tsx scripts/deploy.ts <develop|production> [cf deploy args]")
  process.exit(2)
}
const environment: DeployEnvironment = requested
const shape = ENVIRONMENTS[environment]

function fail(message: string): never {
  console.error(`✗ deploy:${environment}: ${message}`)
  process.exit(1)
}

function readJson<T>(file: string): T {
  if (!existsSync(file)) fail(`${file} not found. Run pnpm build:${environment} first.`)
  return JSON.parse(readFileSync(file, "utf8")) as T
}

// 1. The build must be for this environment.
const { buildContext } = readJson<{ buildContext?: { mode?: string; isPreview?: boolean } }>(`${OUTPUT}/config.json`)
if (buildContext?.mode !== environment || buildContext.isPreview) {
  fail(`the build output is for mode "${buildContext?.mode}". Run pnpm build:${environment} first.`)
}
const app = readJson<{ name: string; env: Record<string, { type: string }> }>(`${OUTPUT}/workers/default/worker.config.json`)
if (app.name !== shape.worker) fail(`the build output is for Worker "${app.name}", expected "${shape.worker}".`)
if (!existsSync(`${OUTPUT}/workers/${shape.responseStore.worker}`)) {
  fail(`the build output has no ${shape.responseStore.worker} Worker.`)
}

// 2. Secret values for every declared secret.
const declared = Object.keys(app.env).filter((name) => app.env[name]?.type === "secret")
const localFile = `.env.${environment}.local`
const local = existsSync(localFile) ? parse(readFileSync(localFile)) : {}
const values = Object.fromEntries(declared.map((name) => [name, process.env[name] || local[name] || ""]))
const missing = declared.filter((name) => !values[name])
if (missing.length > 0) {
  fail(`no value for ${missing.join(", ")}. Set them in the GitHub environment "${environment}" or in ${localFile}.`)
}

// 3. Version metadata: the commit, so a Cloudflare rollback names what it restores.
function git(...args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}
const sha = (process.env.GITHUB_SHA || git("rev-parse", "HEAD")).slice(0, 12)
const message = (process.env.DEPLOY_MESSAGE || git("log", "-1", "--format=%s")).split("\n")[0]!.trim().slice(0, 100)
const versionArgs = [...(sha ? ["--tag", sha] : []), ...(message ? ["--message", message] : [])]

function cf(args: string[]): void {
  const { status } = spawnSync("pnpm", ["exec", "cf", "deploy", "--prebuilt", "--mode", environment, ...args], {
    stdio: "inherit",
  })
  if (status !== 0) fail(`cf deploy ${args.join(" ")} exited with ${status}.`)
}

console.log(`deploy:${environment}: ${shape.responseStore.worker}, then ${shape.worker} (${declared.length} secrets, ${sha})`)

// The application Worker binds to the response store, so that goes first.
cf(["--worker", shape.responseStore.worker, ...versionArgs, ...extraArgs])

const dir = mkdtempSync(join(tmpdir(), "open-spot-secrets-"))
try {
  // JSON, because cf expands $VAR in dotenv files.
  const secretsFile = join(dir, "secrets.json")
  writeFileSync(secretsFile, JSON.stringify(values), { mode: 0o600 })
  cf(["--secrets-file", secretsFile, ...versionArgs, ...extraArgs])
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(`✓ deploy:${environment}: ${shape.worker} ${sha}`)
