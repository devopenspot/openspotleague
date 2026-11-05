"use client";

/**
 * Contest standings per division: rank chip, rider, Junior/Senior + city,
 * score, a "You" tag and a Provisional badge before publishing. Street
 * divisions add the best-trick board. Members refetch on every contest
 * version (realtime); visitors on public contests load once.
 */

import { useEffect, useState } from "react";
import { BODY, CARD, CARD_TITLE, EMPTY_STATE, EYEBROW, LABEL, SEGMENTED_TRACK, segmentClass, tagClass } from "@/components/ui/recipes";
import { DEFAULT_READ_TIMEOUT_MS, fetchWithTimeout } from "@/lib/utils/fetch-timeout";
import type { ContestStandings, DivisionStandings } from "@/lib/services/league/standings";

export function StandingsBoard({
  eventId,
  viewerId,
  refreshKey,
  hideWhenUnavailable = false,
}: {
  eventId: string;
  viewerId: string | null;
  /** Changes (contest version) trigger a refetch. */
  refreshKey?: number;
  /** Public pages render nothing until standings are published. */
  hideWhenUnavailable?: boolean;
}) {
  const [standings, setStandings] = useState<ContestStandings | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [divisionId, setDivisionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchWithTimeout(`/api/league/events/${eventId}/standings`, {
          cache: "no-store",
          timeoutMs: DEFAULT_READ_TIMEOUT_MS,
        });
        if (cancelled) return;
        if (response.status === 404) {
          setStatus("unavailable");
          return;
        }
        if (!response.ok) {
          setStatus("error");
          return;
        }
        const data = (await response.json()) as ContestStandings;
        if (cancelled) return;
        setStandings(data);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey]);

  if (status === "unavailable" || (hideWhenUnavailable && (!standings || !standings.published))) {
    return hideWhenUnavailable ? null : (
      <div className={EMPTY_STATE}>
        <p className={CARD_TITLE}>Standings aren&apos;t available</p>
      </div>
    );
  }
  if (status === "loading" && !standings) {
    return (
      <div aria-busy="true" className="space-y-2">
        <p className="sr-only">Loading standings…</p>
        {[0, 1, 2].map((index) => (
          <div key={index} aria-hidden="true" className="h-14 animate-pulse rounded-inner bg-surface-container-high" />
        ))}
      </div>
    );
  }
  if (!standings) {
    return <p className={BODY}>Standings could not be loaded. They refresh automatically.</p>;
  }

  const divisions = standings.divisions;
  const active = divisions.find((division) => division.divisionId === divisionId) ?? divisions[0] ?? null;

  return (
    <section aria-labelledby="standings-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="standings-title" className={CARD_TITLE}>
          Standings
        </h3>
        <span className={tagClass(standings.published ? "solid" : "outline")}>
          {standings.published ? "Final" : "Provisional"}
        </span>
      </div>
      {!standings.published ? (
        <p className={BODY}>Live panel scores. Final ranks and league points are set when results are published.</p>
      ) : null}

      {divisions.length > 1 ? (
        <div role="tablist" aria-label="Divisions" className={SEGMENTED_TRACK}>
          {divisions.map((division) => (
            <button
              key={division.divisionId}
              type="button"
              role="tab"
              aria-selected={active?.divisionId === division.divisionId}
              onClick={() => setDivisionId(division.divisionId)}
              className={segmentClass(active?.divisionId === division.divisionId)}
            >
              {division.label}
            </button>
          ))}
        </div>
      ) : null}

      {active ? <DivisionTable division={active} viewerId={viewerId} published={standings.published} /> : null}
    </section>
  );
}

function DivisionTable({
  division,
  viewerId,
  published,
}: {
  division: DivisionStandings;
  viewerId: string | null;
  published: boolean;
}) {
  if (division.rows.length === 0) {
    return (
      <div className={EMPTY_STATE}>
        <p className={CARD_TITLE}>No scores yet</p>
        <p className={`mx-auto mt-2 max-w-md ${BODY}`}>Runs appear here as soon as a judge scores them.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ol aria-label={`${division.label} standings`} className={`${CARD} space-y-1.5`}>
        {division.rows.map((row) => {
          const you = row.userId === viewerId;
          return (
            <li
              key={row.userId}
              className={`flex items-center gap-3 rounded-inner px-3 py-2 ${you ? "bg-surface-container" : ""}`}
            >
              <span
                aria-label={`Rank ${row.rank}`}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control font-display text-sm font-bold tabular-nums ${row.rank === 1 ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"}`}
              >
                {row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-on-surface">
                  <span className="truncate">{row.riderName}</span>
                  {you ? <span className={tagClass("solid")}>You</span> : null}
                </p>
                <p className={LABEL}>
                  {[row.ageCategory === "junior" ? "Junior" : row.ageCategory === "senior" ? "Senior" : null, row.city]
                    .filter(Boolean)
                    .join(" · ") || " "}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold tabular-nums text-on-surface">{row.score.toFixed(2)}</p>
                {published && row.pointsAwarded !== null ? <p className={LABEL}>+{row.pointsAwarded} pts</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {division.hasBestTrick && division.bestTricks.length > 0 ? (
        <section aria-label={`${division.label} best trick`} className={CARD}>
          <p className={EYEBROW}>Best trick</p>
          <ol className="mt-2 space-y-1">
            {division.bestTricks.map((entry) => (
              <li key={entry.userId} className="flex items-center justify-between gap-3 px-1 py-1 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold tabular-nums">#{entry.rank}</span> {entry.riderName}
                </span>
                <span className="font-semibold tabular-nums">{entry.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
