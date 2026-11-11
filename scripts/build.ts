/**
 * pnpm build:develop | pnpm build:production   (docs/environments.md)
 *
 * Builds the Worker for one environment: `vite build --mode <env>`, with the
 * committed `.env.<env>` loaded into the process environment first. That
 * matters because vinext lets `.env.local` (develop values, on a laptop) win
 * over `.env.<mode>`, and NEXT_PUBLIC_* values are baked into the browser
 * bundle. Needs no database and no secrets.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { parse } from "dotenv"
import { isDeployEnvironment, readEnvironmentFile } from "../cloudflare.config"

const environment = process.argv[2]
if (!isDeployEnvironment(environment)) {
  console.error("Usage: tsx scripts/build.ts <develop|production> [vite build args]")
  process.exit(2)
}

const committed = readEnvironmentFile(environment)
const env: NodeJS.ProcessEnv = {
  ...process.env,
  ...committed,
  APP_ENV: environment,
  NEXT_PUBLIC_APP_ENV: environment,
  NODE_ENV: "production",
}

// A NEXT_PUBLIC_* value that exists only in a local file would be inlined into
// this environment's bundle. Blank it so local values never leak.
const localFiles = [`.env.${environment}.local`, ".env.local", ".env"]
const leaked = new Set<string>()
for (const file of localFiles) {
  if (!existsSync(file)) continue
  for (const name of Object.keys(parse(readFileSync(file)))) {
    if (name.startsWith("NEXT_PUBLIC_") && !(name in committed) && name !== "NEXT_PUBLIC_APP_ENV") {
      env[name] = ""
      leaked.add(name)
    }
  }
}
if (leaked.size > 0) {
  console.warn(
    `build:${environment}: ignoring ${[...leaked].join(", ")} from local env files. ` +
      `Add them to .env.${environment} if this environment needs them.`,
  )
}

console.log(`build:${environment}: vite build --mode ${environment} (APP_URL ${committed.APP_URL})`)
const { status } = spawnSync("pnpm", ["exec", "vite", "build", "--mode", environment, ...process.argv.slice(3)], {
  stdio: "inherit",
  env,
})
process.exit(status ?? 1)
