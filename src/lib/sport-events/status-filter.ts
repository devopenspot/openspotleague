"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  SportEventStatusFilterSchema,
  type SportEventStatusFilter,
} from "@/lib/schemas/event";
import { deriveStatus } from "@/lib/sport-events/status";
import type {
  SportEvent,
  SportEventEnriched,
  SportEventStatus,
} from "@/types/sport-events";

/**
 * Resolve the active status filter from the URL. The default is
 * `all` (no param). The `all` value is implicit and not serialized
 * in the URL.
 */
export function readStatusFilter(
  searchParams: URLSearchParams,
): SportEventStatusFilter {
  const raw = searchParams.get("status");
  const parsed = SportEventStatusFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : "all";
}

export interface EventStatusFilter {
  status: SportEventStatusFilter;
  filter: <T extends SportEvent>(events: readonly T[]) => readonly T[];
}

export function buildStatusFilterUrl(
  pathname: string,
  searchParams: URLSearchParams,
  next: SportEventStatusFilter,
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (next === "all") params.delete("status");
  else params.set("status", next);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function isStatus(value: unknown): value is SportEventStatus {
  return value === "live" || value === "upcoming" || value === "completed";
}

/**
 * Prefer the status already calculated by the server for enriched events.
 * Raw events still use the date-derived fallback for callers outside the
 * directory page.
 */
export function filterEventsByStatus<T extends SportEvent>(
  events: readonly T[],
  status: SportEventStatusFilter,
  now: Date = new Date(),
): readonly T[] {
  if (status === "all") return events;
  return events.filter((event) => {
    const enrichedStatus = (event as unknown as Partial<SportEventEnriched>).status;
    const eventStatus = isStatus(enrichedStatus)
      ? enrichedStatus
      : deriveStatus(event, now);
    return eventStatus === status;
  });
}

/**
 * Status filter for `/sport-events?status=…`. The status field is
 * derived from the event's start/end dates (see
 * `src/lib/sport-events/status.ts`) and the filter is applied on
 * the client after the cached `listEvents()` returns.
 *
 * The URL is the single source of truth for the active filter —
 * there is no `useState`, no store entry, no `useRef`.
 */
export function useEventStatusFilter(): EventStatusFilter {
  const searchParams = useSearchParams();
  const status = useMemo(
    () => readStatusFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  return useMemo(
    () => ({
      status,
      filter: <T extends SportEvent>(events: readonly T[]): readonly T[] => {
        return filterEventsByStatus(events, status);
      },
    }),
    [status],
  );
}
