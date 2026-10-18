import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/lib/config/env"

function getCursorSecret(): string {
  return env.CURSOR_HMAC_SECRET ?? env.SUPABASE_SECRET_KEY ?? "cursor-dev-secret-not-for-prod"
}

export function createCursorCodec<T extends object>(opts?: { version?: number; maxBytes?: number }) {
  const CURSOR_VERSION = opts?.version ?? 1;
  const maxBytes = opts?.maxBytes ?? 8192;
  const UUID_PATTERN = /^[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    encode: (payload: T): string => {
      const body = Buffer.from(JSON.stringify({ v: CURSOR_VERSION, ...payload })).toString("base64url")
      const sig = createHmac("sha256", getCursorSecret()).update(body).digest("base64url")
      return `${body}.${sig}`
    },
    decode: (cursor: string): T | null => {
      if (cursor.length > maxBytes) return null;
      const dot = cursor.lastIndexOf(".")
      // Support unsigned legacy cursors (pre-HMAC) by falling through to plain decode
      if (dot === -1) {
        try {
          const json = Buffer.from(cursor, "base64url").toString("utf-8");
          const parsed = JSON.parse(json) as Record<string, unknown> & { v?: number };
          if (parsed.v !== CURSOR_VERSION) return null;
          const { v: _v, ...rest } = parsed;
          return rest as T;
        } catch {
          return null;
        }
      }
      const body = cursor.slice(0, dot)
      const sig = cursor.slice(dot + 1)
      if (!body || !sig) return null
      const expect = createHmac("sha256", getCursorSecret()).update(body).digest("base64url")
      try {
        if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
      } catch {
        return null
      }
      try {
        const json = Buffer.from(body, "base64url").toString("utf-8");
        if (json.length > maxBytes) return null
        const parsed = JSON.parse(json) as Record<string, unknown> & { v?: number };
        if (parsed.v !== CURSOR_VERSION) return null;
        const { v: _v, ...rest } = parsed;
        for (const val of Object.values(rest)) {
          if (typeof val === "string" && val.length === 36 && !UUID_PATTERN.test(val)) {
            // allow non-UUID strings
          }
        }
        return rest as T;
      } catch {
        return null;
      }
    },
  };
}
