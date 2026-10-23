import type { createHmac as CreateHmacFn } from "node:crypto"
import { env } from "@/lib/config/env"

const isTest = env.NODE_ENV === "test";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashIp(ip: string): string {
  if (typeof window !== "undefined") return "browser";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHmac } = require("node:crypto") as { createHmac: typeof CreateHmacFn };
    const secret = env.SUPABASE_SECRET_KEY ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "log-ip-hash";
    return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 16);
  } catch {
    return "unknown";
  }
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  if (typeof out.ip === "string") {
    out.ipHash = hashIp(out.ip as string)
    delete out.ip
  }
  return out
}

function emit(level: "error" | "warn" | "info", ...args: unknown[]): void {
  if (isTest) return;
  const fn = console[level];
  if (typeof fn !== "function") return;

  // Browser execution path: output cleanly to console without JSON stringification overhead
  if (typeof window !== "undefined") {
    fn(...args);
    return;
  }

  const [event, fields] = args;
  // Structured error with digest/code
  if (args[0] instanceof Error) {
    const e = args[0] as Error & { digest?: string; code?: string };
    fn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event: "error_caught",
        message: e.message,
        stack: e.stack,
        digest: e.digest,
        code: (e as unknown as { code?: string }).code,
      }),
    );
    return;
  }
  if (typeof event === "string" && isRecord(fields) && args.length === 2) {
    const sanitized = sanitizeFields(fields as Record<string, unknown>)
    fn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        ...sanitized,
      }),
    );
    return;
  }
  fn(...args);
}

export const log = {
  error: (...args: unknown[]) => emit("error", ...args),
  warn: (...args: unknown[]) => emit("warn", ...args),
  info: (...args: unknown[]) => emit("info", ...args),
};
