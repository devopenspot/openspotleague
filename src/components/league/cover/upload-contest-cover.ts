import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";

/** Uploads take longer than JSON mutations (5 MB on a phone connection). */
const COVER_UPLOAD_TIMEOUT_MS = DEFAULT_MUTATION_TIMEOUT_MS * 4;

/**
 * Multipart POST to `/api/league/events/[id]/cover`: the cover is stored and
 * swapped in one versioned mutation. One idempotency key per attempt.
 */
export function uploadContestCover(input: {
  eventId: string;
  file: File;
  expectedVersion: number;
}): Promise<Response> {
  const form = new FormData();
  form.append("image", input.file);
  form.append("expectedVersion", String(input.expectedVersion));
  form.append("idempotencyKey", crypto.randomUUID());
  return fetchWithTimeout(`/api/league/events/${input.eventId}/cover`, {
    method: "POST",
    body: form,
    timeoutMs: COVER_UPLOAD_TIMEOUT_MS,
  });
}
