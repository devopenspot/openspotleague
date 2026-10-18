import { InvalidReferenceError } from "@/lib/repositories/core/errors";
import { classifyDatabaseError } from "@/lib/db/client";

export type ApiErrorCode = "INVALID_REF" | "TIMEOUT" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "INTERNAL";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error && err.name === "TimeoutError") return true;
  return classifyDatabaseError(err) === "timeout";
}

function isNotFoundMessage(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not found/i.test(msg);
}

export function mapDomainErrorToResponse(err: unknown): { status: number; body: { error: string; code: ApiErrorCode } } {
  if (err instanceof InvalidReferenceError) {
    return { status: 400, body: { error: err.message, code: "INVALID_REF" } };
  }
  if (isTimeoutError(err)) {
    return { status: 503, body: { error: "Temporarily unavailable", code: "TIMEOUT" } };
  }
  if (isNotFoundMessage(err)) {
    return { status: 404, body: { error: "Not found", code: "NOT_FOUND" } };
  }
  if (err instanceof ApiError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  return { status: 500, body: { error: "Internal error", code: "INTERNAL" } };
}

export function toNextError(err: unknown, digest?: string): Error & { digest?: string; code?: ApiErrorCode } {
  const e = err instanceof Error ? err : new Error(String(err));
  (e as unknown as Record<string, unknown>).digest = digest ?? (err as { digest?: string })?.digest;
  (e as unknown as Record<string, unknown>).code = (err as { code?: string })?.code;
  return e as Error & { digest?: string; code?: ApiErrorCode };
}
