/**
 * Deploy the built Worker with its declared secrets, read from `.env.local`.
 * Run through `pnpm deploy:secrets`, which builds first. Extra arguments go to
 * `cf deploy`, for example `pnpm deploy:secrets --dry-run`.
 *
 * `cf deploy --secrets-file` uploads every key in the file, declared or not, so
 * it must never be pointed at `.env.local`: that would put `CLOUDFLARE_API_TOKEN`
 * and the pooler URLs on the Worker. This writes a temporary file holding only
 * the names declared in `cloudflare.config.ts`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "dotenv";

const WORKER_CONFIG = ".cloudflare/output/v0/workers/default/worker.config.json";

const { env: bindings } = JSON.parse(readFileSync(WORKER_CONFIG, "utf8")) as {
  env: Record<string, { type: string }>;
};
const declared = Object.keys(bindings).filter((name) => bindings[name]?.type === "secret");
const local = parse(readFileSync(".env.local"));

const missing = declared.filter((name) => !local[name]);
if (missing.length > 0) {
  console.error(`Missing from .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "open-spot-secrets-"));
const secretsFile = join(dir, "secrets.json");
let status: number | null;
try {
  // JSON, because cf expands $VAR in dotenv files.
  writeFileSync(
    secretsFile,
    JSON.stringify(Object.fromEntries(declared.map((name) => [name, local[name]]))),
    { mode: 0o600 },
  );
  ({ status } = spawnSync(
    "pnpm",
    ["exec", "cf", "deploy", "--prebuilt", "--secrets-file", secretsFile, ...process.argv.slice(2)],
    { stdio: "inherit" },
  ));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(status ?? 1);
