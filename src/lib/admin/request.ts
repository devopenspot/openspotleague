const REQUEST_TIMEOUT_MS = 15_000;

type OnResponse = (response: Response) => void;

/**
 * Shared admin fetch helper.
 * - Aborts after 15s (parity with RegionManager)
 * - Parses `{error?:string}` bodies
 * - Throws `Error(body.error ?? HTTP status)` for !ok
 * - Preserves `cause` for AbortError to satisfy `preserve-caught-error`
 */
export async function adminRequest(
  url: string,
  options?: RequestInit,
  onResponse?: OnResponse,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    onResponse?.(response);
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const wrapped = new Error("Request timed out — please try again");
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getAdminErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
