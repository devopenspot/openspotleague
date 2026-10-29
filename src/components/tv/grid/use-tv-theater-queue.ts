"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TV_CARD_BATCH_MAX, type TvCard, type TvCategory } from "@/types/tv";
import type { TvCategoryRow } from "@/lib/services/tv/tv";
import type { TheaterCategory } from "@/components/tv/player/TvCategoryPills";
import {
  filterByDiscipline,
  formatTvCategory,
} from "@/components/tv/marquee/tv-marquee-data";
import { fetchWithTimeout } from "@/lib/utils/fetch-timeout";

export interface UseTvTheaterQueueProps {
  discipline: string;
  categoryRows: readonly TvCategoryRow[];
  videos: readonly TvCard[];
  videoById: ReadonlyMap<string, TvCard>;
  activeId: string | null;
  autoAdvance: boolean;
  openWithId: (id: string, autoplay: boolean) => void;
  appendRowVideos: (
    items: readonly TvCard[],
    category?: TvCategory,
    nextCursor?: string | null,
  ) => void;
}

export function useTvTheaterQueue({
  discipline,
  categoryRows,
  videos,
  videoById,
  activeId,
  autoAdvance,
  openWithId,
  appendRowVideos,
}: UseTvTheaterQueueProps) {
  const [theaterCategory, setTheaterCategory] =
    useState<TheaterCategory>("all");
  const [queueSnapshot, setQueueSnapshot] = useState<{
    key: string;
    ids: readonly string[];
  } | null>(null);

  const resetQueueSnapshot = useCallback(() => {
    setQueueSnapshot(null);
  }, []);

  const prevDisciplineRef = useRef(discipline);
  useEffect(() => {
    if (prevDisciplineRef.current !== discipline) {
      prevDisciplineRef.current = discipline;
      setQueueSnapshot(null);
    }
  }, [discipline]);

  const resetTheaterCategory = useCallback(() => {
    setTheaterCategory("all");
  }, []);

  const filtered = useMemo(
    () => filterByDiscipline(videos, discipline),
    [videos, discipline],
  );

  const theaterQueue = useMemo(
    () =>
      theaterCategory === "all"
        ? filtered
        : filtered.filter((v) =>
            v.categories.some(
              (c) => c.toLowerCase() === theaterCategory.toLowerCase(),
            ),
          ),
    [filtered, theaterCategory],
  );

  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return theaterQueue.findIndex((v) => v.id === activeId);
  }, [theaterQueue, activeId]);

  const totalForTheaterFilter = useMemo(() => {
    if (theaterCategory === "all") {
      const allRowsLoaded =
        categoryRows.length > 0 &&
        categoryRows.every(
          (row) => row.nextCursor === null && row.videos.length >= row.total,
        );
      if (allRowsLoaded) {
        return filtered.length;
      }
      return categoryRows.reduce((sum, row) => sum + row.total, 0);
    }
    return (
      categoryRows.find(
        (row) => row.category.toLowerCase() === theaterCategory.toLowerCase(),
      )?.total ?? 0
    );
  }, [categoryRows, theaterCategory, filtered.length]);

  const theaterCategories = useMemo(
    () =>
      categoryRows.map((row) => ({
        category: row.category,
        count: row.total,
      })),
    [categoryRows],
  );

  const queueKey = `${discipline}|${theaterCategory}`;
  const queueIds = queueSnapshot?.key === queueKey ? queueSnapshot.ids : null;

  const queueInFlightRef = useRef<{
    key: string;
    promise: Promise<readonly string[] | null>;
  } | null>(null);

  const ensureQueueIds = useCallback(async (): Promise<
    readonly string[] | null
  > => {
    if (queueIds) return queueIds;
    const inFlight = queueInFlightRef.current;
    if (inFlight && inFlight.key === queueKey) return inFlight.promise;
    const promise = (async (): Promise<readonly string[] | null> => {
      const params = new URLSearchParams();
      if (discipline !== "all") params.set("discipline", discipline);
      if (theaterCategory !== "all") params.set("category", theaterCategory);
      const qs = params.toString();
      try {
        const res = await fetchWithTimeout(
          `/api/tv/ids${qs ? `?${qs}` : ""}`,
          { timeoutMs: 10_000 },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { ids?: unknown };
        if (!Array.isArray(data.ids)) return null;
        const ids = data.ids.filter(
          (id): id is string => typeof id === "string",
        );
        setQueueSnapshot({ key: queueKey, ids });
        return ids;
      } catch {
        return null;
      }
    })();
    queueInFlightRef.current = { key: queueKey, promise };
    try {
      return await promise;
    } finally {
      if (queueInFlightRef.current?.key === queueKey) {
        queueInFlightRef.current = null;
      }
    }
  }, [queueIds, queueKey, discipline, theaterCategory]);

  useEffect(() => {
    if (!activeId || queueIds) return;
    if (theaterQueue.length >= totalForTheaterFilter) return;
    const rightUnknown =
      activeIndex === -1 || theaterQueue[activeIndex + 1] === undefined;
    if (!rightUnknown) return;
    void ensureQueueIds();
  }, [
    activeId,
    queueIds,
    activeIndex,
    theaterQueue,
    totalForTheaterFilter,
    ensureQueueIds,
  ]);

  const navBusyRef = useRef(false);
  const resolveStep = useCallback(
    async (dir: -1 | 1): Promise<void> => {
      if (!activeId || navBusyRef.current) return;
      navBusyRef.current = true;
      try {
        const idx = theaterQueue.findIndex((v) => v.id === activeId);
        if (idx !== -1) {
          const neighbor = theaterQueue[idx + dir];
          if (neighbor) {
            openWithId(neighbor.id, autoAdvance);
            return;
          }
        } else if (dir === 1) {
          const first = theaterQueue[0];
          if (first) {
            openWithId(first.id, autoAdvance);
            return;
          }
        }
        if (!queueIds && theaterQueue.length >= totalForTheaterFilter) return;
        const ids = queueIds ?? (await ensureQueueIds());
        if (!ids) return;
        let pos = ids.indexOf(activeId);
        if (pos === -1) pos = dir === 1 ? -1 : ids.length;
        const walkLimit = TV_CARD_BATCH_MAX * 3;
        let visited = 0;
        while (visited < walkLimit) {
          const window: string[] = [];
          while (window.length < TV_CARD_BATCH_MAX && visited < walkLimit) {
            pos += dir;
            const id = ids[pos];
            visited++;
            if (!id) break;
            const known = videoById.get(id);
            if (known) {
              openWithId(known.id, autoAdvance);
              return;
            }
            window.push(id);
          }
          if (window.length === 0) return;
          try {
            const res = await fetchWithTimeout(
              `/api/tv?ids=${window.map((id) => encodeURIComponent(id)).join(",")}`,
              { timeoutMs: 10_000 },
            );
            if (!res.ok) continue;
            const data = (await res.json()) as { cards?: unknown };
            const resolved = new Map<string, TvCard>();
            for (const entry of Array.isArray(data.cards) ? data.cards : []) {
              if (
                entry !== null &&
                typeof entry === "object" &&
                typeof (entry as TvCard).id === "string"
              ) {
                const card = entry as TvCard;
                resolved.set(card.id, card);
                appendRowVideos([card]);
              }
            }
            for (const id of window) {
              const card = resolved.get(id);
              if (card) {
                openWithId(card.id, autoAdvance);
                return;
              }
            }
          } catch {
            continue;
          }
        }
      } finally {
        navBusyRef.current = false;
      }
    },
    [
      activeId,
      theaterQueue,
      videoById,
      queueIds,
      ensureQueueIds,
      openWithId,
      autoAdvance,
      appendRowVideos,
      totalForTheaterFilter,
    ],
  );

  const goPrev = useCallback(() => {
    void resolveStep(-1);
  }, [resolveStep]);

  const goNext = useCallback(() => {
    void resolveStep(1);
  }, [resolveStep]);

  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const loadingQueueRef = useRef(false);

  const getCategoryCursor = useCallback(
    (cat: string): string | null => {
      return categoryRows.find((r) => r.category === cat)?.nextCursor ?? null;
    },
    [categoryRows],
  );

  const loadMoreForCategory = useCallback(
    async (cat: TvCategory): Promise<readonly TvCard[]> => {
      const cursor = getCategoryCursor(cat);
      const row = categoryRows.find((r) => r.category === cat);
      if (cursor === null && row && row.videos.length >= row.total) {
        return [];
      }

      const params = new URLSearchParams();
      params.set("limit", "12");
      params.set("category", cat);
      if (discipline !== "all") params.set("discipline", discipline);
      if (cursor) params.set("cursor", cursor);

      try {
        const res = await fetchWithTimeout(`/api/tv?${params.toString()}`, {
          timeoutMs: 10_000,
        });
        if (!res.ok) {
          appendRowVideos([], cat, null);
          return [];
        }
        const data = (await res.json()) as {
          items?: unknown;
          nextCursor?: unknown;
        };
        const items = Array.isArray(data.items)
          ? (data.items.filter(
              (v): v is TvCard =>
                typeof v === "object" &&
                v !== null &&
                typeof (v as TvCard).id === "string",
            ) ?? [])
          : [];

        const nextC =
          typeof data.nextCursor === "string" ? data.nextCursor : null;
        appendRowVideos(items, cat, nextC);
        return items;
      } catch {
        appendRowVideos([], cat, null);
        return [];
      }
    },
    [getCategoryCursor, categoryRows, discipline, appendRowVideos],
  );

  const handleLoadMoreQueue = useCallback(async () => {
    if (loadingQueueRef.current) return;
    loadingQueueRef.current = true;
    setIsLoadingQueue(true);
    try {
      if (theaterCategory === "all") {
        const nextCatRow = categoryRows.find((r) => {
          const cursor = getCategoryCursor(r.category);
          return cursor !== null || r.videos.length < r.total;
        });
        if (nextCatRow) {
          await loadMoreForCategory(nextCatRow.category);
        }
      } else {
        await loadMoreForCategory(theaterCategory);
      }
    } finally {
      loadingQueueRef.current = false;
      setIsLoadingQueue(false);
    }
  }, [theaterCategory, categoryRows, getCategoryCursor, loadMoreForCategory]);

  const hasMoreQueue = useMemo(() => {
    if (theaterCategory === "all") {
      return categoryRows.some((r) => {
        const cursor = getCategoryCursor(r.category);
        return cursor !== null || r.videos.length < r.total;
      });
    }
    const row = categoryRows.find((r) => r.category === theaterCategory);
    if (!row) return false;
    const cursor = getCategoryCursor(theaterCategory);
    return cursor !== null || row.videos.length < row.total;
  }, [theaterCategory, categoryRows, getCategoryCursor]);

  const selectTheaterCategory = useCallback(
    async (cat: TheaterCategory) => {
      setTheaterCategory(cat);
      if (cat === "all") return;
      const needle = cat.toLowerCase();
      const next = filtered.filter((v) =>
        v.categories.some((c) => c.toLowerCase() === needle),
      );
      if (next.length > 0) {
        if (activeId && next.some((v) => v.id === activeId)) return;
        const first = next[0];
        if (first) openWithId(first.id, autoAdvance);
      } else {
        loadingQueueRef.current = true;
        setIsLoadingQueue(true);
        try {
          const items = await loadMoreForCategory(cat);
          const first = items[0];
          if (first) openWithId(first.id, autoAdvance);
        } finally {
          loadingQueueRef.current = false;
          setIsLoadingQueue(false);
        }
      }
    },
    [filtered, activeId, autoAdvance, openWithId, loadMoreForCategory],
  );

  const queuePos = activeId && queueIds ? queueIds.indexOf(activeId) : -1;
  const categoryLabel =
    theaterCategory === "all" ? "All" : formatTvCategory(theaterCategory);

  return {
    theaterCategory,
    setTheaterCategory,
    resetTheaterCategory,
    theaterQueue,
    filtered,
    activeIndex,
    totalForTheaterFilter,
    theaterCategories,
    categoryLabel,
    queueIds,
    queuePos,
    goPrev,
    goNext,
    hasMoreQueue,
    isLoadingQueue,
    handleLoadMoreQueue,
    selectTheaterCategory,
    resetQueueSnapshot,
  };
}
