import { log } from "@/lib/utils/log";

/**
 * Central audit helper for admin mutations.
 * All admin writes should emit a structured `audit.*` event so production
 * traces can correlate actor + target + requestId without grepping raw errors.
 */
export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export function auditInfo(event: string, fields: Record<string, unknown>): void {
  log.info(event, fields);
}

export function auditWarn(event: string, fields: Record<string, unknown>): void {
  log.warn(event, fields);
}

export function auditError(event: string, fields: Record<string, unknown>): void {
  log.error(event, fields);
}

/**
 * Helper to build a JSON response that always echoes `x-request-id`
 * (proxy already sets it on `NextResponse.next`, but API route handlers
 * return their own `NextResponse.json` which would otherwise drop it).
 */
export function withRequestIdHeaders(requestId: string): HeadersInit {
  return { "x-request-id": requestId };
}
