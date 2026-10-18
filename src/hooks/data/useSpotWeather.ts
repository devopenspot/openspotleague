'use client';

import { useEffect, useReducer, useState } from 'react';
import { useWeather } from '@/components/shell/WeatherContext';
import { log } from '@/lib/utils/log';
import type { SpotWeather } from '@/lib/weather/weather-cached';

interface WeatherBatchResponse {
	weather: Record<string, SpotWeather>;
}

// In-flight request dedup. Two components that both ask for
// "id1,id2" on the same render coalesce into one HTTP round trip.
// Mirrors the per-process single-flight pattern in
// `src/lib/weather/fetchers.ts` but at the `/api/weather` boundary.
const inflight = new Map<string, Promise<WeatherBatchResponse>>();
const MAX_IDS_PER_REQUEST = 50;

function keyFor(ids: readonly string[]): string {
	// Order-stable so two callers asking for the same set in any
	// order hit the same dedup key.
	return [...ids].sort().join(',');
}

export function splitIntoBatches<T>(items: readonly T[], size: number): T[][] {
	if (size <= 0) throw new Error('Batch size must be positive');
	const batches: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		batches.push(items.slice(index, index + size));
	}
	return batches;
}

async function fetchWeatherBatch(
	ids: readonly string[],
): Promise<WeatherBatchResponse> {
	// No `signal` here — the shared fetch runs to completion. The
	// result lands in the per-spot `"use cache"` on the server, so
	// any bandwidth spent on a "stale" request (e.g. one fired by
	// a component the user has already navigated away from) is
	// reused by the next visitor. Cancelling the fetch on caller
	// unmount saves a few hundred ms of upstream time at the cost
	// of breaking the shared-promise contract: a second caller
	// arriving while the first is in flight would inherit the
	// aborted promise and never receive the data. That is the bug
	// the previous design shipped.
	const url = `/api/weather?spotIds=${encodeURIComponent(ids.join(','))}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`weather fetch failed: ${res.status}`);
	}
	return (await res.json()) as WeatherBatchResponse;
}

function getOrCreateInflight(
	ids: readonly string[],
): Promise<WeatherBatchResponse> {
	const key = keyFor(ids);
	const existing = inflight.get(key);
	if (existing) return existing;
	const promise = fetchWeatherBatch(ids).finally(() => {
		inflight.delete(key);
	});
	inflight.set(key, promise);
	return promise;
}

/**
 * Fetch (and cache) the weather for a single spot. The first caller
 * for a given spot triggers the HTTP round trip; subsequent callers
 * (and the next render of the same caller) read the value from
 * `WeatherContext` and never re-fetch. The per-spot `"use cache"`
 * boundary on the server means the second spot to be requested
 * (across all clients) is also free.
 *
 * Returns just the `weather` value; "is it loading" is implicit in
 * "is the data not yet in the context" — no `isLoading` state to
 * avoid the React 19 cascading-render rule.
 */
export function useSpotWeather(
	spotId: string | null | undefined,
	opts?: { throwOnError?: boolean },
): { weather: SpotWeather | undefined } {
	const { weather, setWeather } = useWeather();
	const [throwableError, setThrowableError] = useState<Error | null>(null);
	if (throwableError) throw throwableError;

	useEffect(() => {
		if (!spotId) return;
		if (weather[spotId]) return;
		// `cancelled` is a local closure flag, not React state. The
		// cleanup function only sets it — it does NOT abort the
		// underlying fetch. The fetch is shared via the inflight
		// map, so aborting it from one caller would break every
		// other caller waiting on the same promise. The data still
		// lands in the per-spot `"use cache"`, so the next visitor
		// pays nothing for the request we let complete.
		let cancelled = false;
		getOrCreateInflight([spotId])
			.then((data) => {
				if (cancelled) return;
				const w = data.weather[spotId];
				if (w) setWeather(spotId, w);
			})
			.catch((err) => {
				if (cancelled) return;
				if (err instanceof Error && err.name === "AbortError") return;
				if (opts?.throwOnError) {
					setThrowableError(err instanceof Error ? err : new Error(String(err)));
					return;
				}
				log.warn('useSpotWeather', spotId, err);
			});
		return () => {
			cancelled = true;
		};
		// We intentionally don't depend on `weather` — reading it would
		// re-run the effect on every context update, which would
		// re-fire fetches for already-loaded spots. The `weather[spotId]`
		// guard above is the only check we need.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [spotId]);

	return { weather: spotId ? weather[spotId] : undefined };
}

/**
 * Batch variant. HTTP requests are capped at the route's 50-id limit
 * and deduped across components. The return value is
 * the per-id subset of the context — typically the caller discards
 * it and reads from `useWeather()` directly, but the subset is
 * available for components that want a self-contained value.
 *
 * `isFetching` is true while there are still spots in the requested
 * set that aren't in the context. The toggle button uses it as its
 * "Loading…" signal. Pass `null` to short-circuit (no fetch, no
 * loading) — the map canvas uses this to disable weather entirely
 * until the user opts in.
 */
export function useSpotsWeather(
	spotIds: readonly string[] | null | undefined,
): { weather: Record<string, SpotWeather>; isFetching: boolean } {
	const { weather, setWeather } = useWeather();
	const [failedRequestKey, setFailedRequestKey] = useReducer(
		(_: string | null, next: string | null) => next,
		null,
	);

	const idsKey = spotIds ? keyFor(spotIds) : '';
	// Only the unknown subset triggers a fetch. The known ones are
	// read straight from context, so passing the full 200-spot list
	// on a warm cache is free.
	const missing = spotIds
		? spotIds.filter((id) => !weather[id])
		: [];

	useEffect(() => {
		if (!spotIds) {
			setFailedRequestKey(null);
			return;
		}
		if (missing.length === 0) return;
		setFailedRequestKey(null);
		let cancelled = false;
		Promise.all(
			splitIntoBatches(missing, MAX_IDS_PER_REQUEST).map((batch) =>
				getOrCreateInflight(batch),
			),
		)
			.then((responses) => {
				if (cancelled) return;
				const receivedIds = new Set<string>();
				for (const response of responses) {
					for (const [id, w] of Object.entries(response.weather)) {
						receivedIds.add(id);
						setWeather(id, w);
					}
				}
				if (missing.some((id) => !receivedIds.has(id))) {
					setFailedRequestKey(idsKey);
				}
			})
			.catch((err) => {
				if (cancelled) return;
				if (err instanceof Error && err.name === "AbortError") return;
				setFailedRequestKey(idsKey);
				log.warn('useSpotsWeather', missing.length, err);
			});
		return () => {
			cancelled = true;
		};
		// Same dedup story as useSpotWeather: don't include `weather`
		// in deps. `missing` is recomputed on every render and the
		// guard at the top short-circuits to no-op once everything
		// is loaded.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idsKey]);

	const subset: Record<string, SpotWeather> = {};
	if (spotIds) {
		for (const id of spotIds) {
			const w = weather[id];
			if (w) subset[id] = w;
		}
	}
	return {
		weather: subset,
		isFetching: missing.length > 0 && failedRequestKey !== idsKey,
	};
}
