import dotenv from "dotenv"
import { expand } from "dotenv-expand"
import path from "node:path"

/**
 * Env loading for CLI scripts (docs/environments.md).
 *
 * - Default (local work): `.env.local` wins over the shell, then `.env`.
 * - `OPENSPOT_ENV=develop|production`: `.env.<env>.local` (break-glass
 *   secrets, wins over the shell), then the committed `.env.<env>`, then
 *   `.env`. `.env.local` is never read, so a develop value cannot leak into a
 *   production run. In CI no local files exist: secrets come from the
 *   environment and the committed file fills in the rest.
 *
 * Scripts that touch a database also call `guardDbScript` (./target).
 */
function loadEnvFile(file: string, override: boolean) {
  const r = dotenv.config({ path: file, override, quiet: true })
  if (r.error && !String(r.error).includes("ENOENT")) throw r.error
  if (r.parsed) expand(r)
}

const root = process.cwd()
const requested = process.env.OPENSPOT_ENV?.trim()

if (requested && requested !== "local") {
  if (requested !== "develop" && requested !== "production") {
    throw new Error(`OPENSPOT_ENV must be develop or production, got "${requested}".`)
  }
  loadEnvFile(path.join(root, `.env.${requested}.local`), true)
  loadEnvFile(path.join(root, `.env.${requested}`), false)
} else {
  loadEnvFile(path.join(root, ".env.local"), true)
}
loadEnvFile(path.join(root, ".env"), false)
