import dotenv from "dotenv"
import { expand } from "dotenv-expand"
import path from "node:path"

function loadEnvFile(file: string, override: boolean) {
  const r = dotenv.config({ path: file, override })
  if (r.error && !String(r.error).includes("ENOENT")) throw r.error
  if (r.parsed) expand(r)
}

const root = process.cwd()
loadEnvFile(path.join(root, ".env.local"), true)
loadEnvFile(path.join(root, ".env"), false)
