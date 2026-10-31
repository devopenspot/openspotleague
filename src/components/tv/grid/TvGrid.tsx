"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { orderTvCategories, type TvCard } from "@/types/tv";
import type { TvCategoryRow } from "@/lib/services/tv/tv";
import type { TvCardPageResult } from "@/lib/repositories/tv/tv-repository";
import { TvAutoplayerButton } from "@/components/tv/player/TvAutoplayerButton";
import { TvPlayerModal } from "@/components/tv/player/TvPlayerModal";
import { TvCategoryMarquee } from "@/components/tv/marquee/TvCategoryMarquee";
import { TvDisciplineSwitchingSkeleton } from "./TvDisciplineSwitchingSkeleton";
import { useTvCatalogState } from "./use-tv-catalog-state";
import { useTvDisciplineState } from "./use-tv-discipline-state";
import { useTvTheaterQueue } from "./use-tv-theater-queue";
import { useTvSearchState } from "./use-tv-search-state";
import { getTvResumeTime, useTvWatchHistory } from "./use-tv-watch-history";
import { TvContinueShelf, TvNewShelf } from "./TvShelves";
import { TvFilterBar } from "./TvFilterBar";
import { TvSearchResultsGrid } from "./TvSearchResultsGrid";
import {
  TvDisciplinePills,
  TvGenericEmptyState,
  TvFilteredEmptyState,
} from "./tv-grid-parts";

const AUTO_ADVANCE_KEY = "tv:autoAdvance";

export function TvGrid({
  rows,
  disciplines,
  filterOptions = { years: [], categories: [] },
  initialDiscipline = null,
  initialPlayVideo = null,
  initialQuery = null,
  initialCategory = null,
  initialYear = null,
  initialSearchResults = null,
  newVideos = [],
}: {
  rows: readonly TvCategoryRow[];
  disciplineCounts?: Readonly<Record<string, number>>;
  disciplines: readonly { slug: string; name: string }[];
  filterOptions?: {
    years: readonly number[];
    categories: readonly string[];
  };
  initialDiscipline?: string | null;
  initialPlayVideo?: TvCard | null;
  initialQuery?: string | null;
  initialCategory?: string | null;
  initialYear?: number | null;
  initialSearchResults?: TvCardPageResult | null;
  /** "Just added" shelf cards (newest first), from the server. */
  newVideos?: readonly TvCard[];
}) {
  const searchParams = useSearchParams();
  const gridRef = useRef<HTMLDivElement>(null);
  const playParam = searchParams.get("play") ?? searchParams.get("v") ?? null;
  const pendingThumb = searchParams.get("thumb");
  const pendingTitle = searchParams.get("title");

  const [activeId, setActiveId] = useState<string | null>(
    () => initialPlayVideo?.id ?? null,
  );
  const [isAutoplaying, setIsAutoplaying] = useState(() =>
    Boolean(initialPlayVideo),
  );
  // Resume point for videos opened from the app. Shared links start at 0.
  const [resume, setResume] = useState<{ id: string; seconds: number } | null>(
    null,
  );
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(AUTO_ADVANCE_KEY);
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });

  const {
    discipline,
    pendingDiscipline,
    selectDiscipline,
    disciplineListRef,
    sortedDisciplines,
    disciplineLabel,
  } = useTvDisciplineState({
    rows,
    disciplines,
    initialDiscipline,
    playParam,
  });

  const { categoryRows, videos, videoById, appendRowVideos } =
    useTvCatalogState({
      rows,
      discipline,
      initialPlayVideo,
    });

  const {
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    selectedYear,
    setSelectedYear,
    isSearchActive,
    items: searchItems,
    isLoading: isSearchLoading,
    isLoadingMore: isSearchLoadingMore,
    hasMore: hasMoreSearchResults,
    loadMore: loadMoreSearchResults,
    resetFilters: resetSearchFilters,
  } = useTvSearchState({
    discipline,
    initialQuery,
    initialCategory,
    initialYear,
    initialSearchResults,
  });

  // Ensure any search items loaded from API are registered in videoById
  useEffect(() => {
    if (searchItems.length > 0) {
      appendRowVideos(searchItems);
    }
  }, [searchItems, appendRowVideos]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(filterOptions.categories);
    for (const r of categoryRows) {
      if (r.category) set.add(r.category);
    }
    return orderTvCategories(set);
  }, [filterOptions.categories, categoryRows]);

  // Stable syncUrl — updates history via replaceState to avoid Next.js App Router RSC refetches
  const syncUrl = useCallback(
    (
      id: string | null,
      opts?: { thumb?: string | null; title?: string | null },
    ) => {
      if (typeof window === "undefined") return;
      const search = window.location.search;
      const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
      if (id) {
        params.set("play", id);
        params.delete("v");
        if (opts?.thumb) params.set("thumb", opts.thumb);
        else params.delete("thumb");
        if (opts?.title) params.set("title", opts.title);
        else params.delete("title");
      } else {
        params.delete("play");
        params.delete("v");
        params.delete("thumb");
        params.delete("title");
      }
      const qs = params.toString();
      const next = qs
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      window.history.replaceState(null, "", next);
    },
    [],
  );

  const {
    ids: historyIds,
    progressById,
    track: trackWatch,
    flush: flushHistory,
    clear: clearHistory,
  } = useTvWatchHistory();

  const openWithId = useCallback(
    (
      id: string,
      autoplay: boolean,
      thumb?: string | null,
      title?: string | null,
    ) => {
      setActiveId(id);
      setIsAutoplaying(autoplay);
      setResume({ id, seconds: getTvResumeTime(id) });
      syncUrl(id, { thumb, title });
    },
    [syncUrl],
  );

  // Shelf cards must be resolvable by the theater (`videoById`).
  useEffect(() => {
    if (newVideos.length > 0) appendRowVideos(newVideos);
  }, [newVideos, appendRowVideos]);

  const {
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
  } = useTvTheaterQueue({
    discipline,
    categoryRows,
    videos,
    videoById,
    activeId,
    autoAdvance,
    openWithId,
    appendRowVideos,
  });

  // Persist autoAdvance toggle
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(AUTO_ADVANCE_KEY, autoAdvance ? "1" : "0");
      } catch {
        // ignore quota
      }
    }
  }, [autoAdvance]);

  // Sync back/forward browser history to modal state without RSC refetches
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const search = window.location.search;
      const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
      const play = params.get("play") ?? params.get("v") ?? null;
      if (play !== activeId) {
        setActiveId(play);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeId]);

  // Sync ?play param → modal (shared links + marquee deep-link)
  const lastPlayParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!playParam) {
      lastPlayParamRef.current = null;
      return;
    }
    if (playParam === lastPlayParamRef.current) return;
    if (activeId === playParam) {
      lastPlayParamRef.current = playParam;
      return;
    }
    // Fast path: video already loaded
    if (videoById.has(playParam)) {
      lastPlayParamRef.current = playParam;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing URL deep-link into modal state is intentional
      setActiveId(playParam);
      setIsAutoplaying(true);
      return;
    }
    // Shared video outside loaded rows: fetch single card, then open it.
    lastPlayParamRef.current = playParam;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/tv?id=${encodeURIComponent(playParam)}`);
        if (!res.ok) return;
        const card = (await res.json()) as TvCard | null;
        if (!card || typeof card.id !== "string") return;
        if (cancelled) return;
        appendRowVideos([card]);
        setActiveId(card.id);
        setIsAutoplaying(true);
      } catch {
        // Transient miss
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playParam, videoById, activeId, appendRowVideos]);

  const searchIndex = useMemo(
    () => (activeId ? searchItems.findIndex((v) => v.id === activeId) : -1),
    [activeId, searchItems],
  );

  const goPrevSearch = useCallback(() => {
    if (searchIndex > 0) {
      const prevVideo = searchItems[searchIndex - 1];
      if (prevVideo) openWithId(prevVideo.id, autoAdvance);
    }
  }, [searchIndex, searchItems, autoAdvance, openWithId]);

  const goNextSearch = useCallback(() => {
    if (searchIndex < searchItems.length - 1) {
      const nextVideo = searchItems[searchIndex + 1];
      if (nextVideo) openWithId(nextVideo.id, autoAdvance);
    } else if (hasMoreSearchResults) {
      void loadMoreSearchResults();
    }
  }, [
    searchIndex,
    searchItems,
    hasMoreSearchResults,
    loadMoreSearchResults,
    autoAdvance,
    openWithId,
  ]);

  // Starts at a random loaded video, then plays on through the queue.
  const handleShuffle = useCallback(() => {
    let pool: readonly TvCard[] = filtered;
    if (isSearchActive) pool = searchItems;
    else if (theaterQueue.length > 0) pool = theaterQueue;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    setAutoAdvance(true);
    openWithId(pick.id, true);
  }, [isSearchActive, searchItems, theaterQueue, filtered, openWithId]);

  const handleSeeAll = useCallback(
    (category: string) => {
      setSelectedCategory(category);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      // The shell scrolls an inner container, so anchor to the grid itself.
      gridRef.current?.scrollIntoView?.({
        block: "start",
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [setSelectedCategory],
  );

  const handleSelectSearchVideo = useCallback(
    (video: TvCard) => {
      openWithId(video.id, autoAdvance);
    },
    [openWithId, autoAdvance],
  );

  const handleSelect = useCallback(
    (video: TvCard, category?: string) => {
      if (category) {
        setTheaterCategory(category);
      }
      openWithId(video.id, autoAdvance);
    },
    [openWithId, autoAdvance, setTheaterCategory],
  );

  const handleSelectShelfVideo = useCallback(
    (video: TvCard) => {
      openWithId(video.id, autoAdvance);
    },
    [openWithId, autoAdvance],
  );

  const selectFromQueue = useCallback(
    (id: string) => {
      openWithId(id, autoAdvance);
    },
    [openWithId, autoAdvance],
  );

  const handleClose = useCallback(() => {
    setActiveId(null);
    setIsAutoplaying(false);
    resetTheaterCategory();
    syncUrl(null);
    flushHistory();
  }, [syncUrl, resetTheaterCategory, flushHistory]);

  const handleEnded = useCallback(() => {
    if (!autoAdvance) return;
    if (isSearchActive) {
      goNextSearch();
    } else {
      goNext();
    }
  }, [autoAdvance, isSearchActive, goNextSearch, goNext]);

  const searchVideoById = useMemo(
    () => new Map(searchItems.map((v) => [v.id, v] as const)),
    [searchItems],
  );

  const activeVideo = useMemo(() => {
    if (!activeId) return null;
    return searchVideoById.get(activeId) ?? videoById.get(activeId) ?? null;
  }, [searchVideoById, videoById, activeId]);

  const isModalOpen = Boolean(activeVideo);
  const hasVideos = rows.length > 0;
  const showGenericEmpty = !hasVideos && discipline === "all";

  return (
    <div
      ref={gridRef}
      className="min-w-0 scroll-mt-20 space-y-2 sm:space-y-4 overflow-x-hidden px-3 mt-6 mb-30"
    >
      {/* Background container — suspended and hidden from compositor when modal is active */}
      <div
        aria-hidden={isModalOpen ? true : undefined}
        inert={isModalOpen ? true : undefined}
        style={{ visibility: isModalOpen ? "hidden" : "visible" }}
        className="space-y-2 sm:space-y-4"
      >
        <TvDisciplinePills
          listRef={disciplineListRef}
          disciplines={sortedDisciplines}
          selected={discipline}
          onSelect={selectDiscipline}
        />

        {/* Search & Filter Bar */}
        <TvFilterBar
          query={query}
          onQueryChange={setQuery}
          categories={allCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        >
          <TvAutoplayerButton
            count={isSearchActive ? searchItems.length : totalForTheaterFilter}
            disciplineLabel={disciplineLabel}
            categoryLabel={isSearchActive ? undefined : categoryLabel}
            onOpen={handleShuffle}
            disabled={
              isSearchActive
                ? searchItems.length === 0
                : totalForTheaterFilter === 0
            }
          />
        </TvFilterBar>

        {showGenericEmpty ? (
          <TvGenericEmptyState />
        ) : pendingDiscipline ? (
          <TvDisciplineSwitchingSkeleton
            label={`Loading ${
              pendingDiscipline === "all"
                ? "all sports"
                : (disciplines.find((d) => d.slug === pendingDiscipline)
                    ?.name ?? pendingDiscipline)
            } videos…`}
          />
        ) : isSearchActive ? (
          <TvSearchResultsGrid
            items={searchItems}
            isLoading={isSearchLoading}
            isLoadingMore={isSearchLoadingMore}
            hasMore={hasMoreSearchResults}
            onLoadMore={loadMoreSearchResults}
            activeId={activeId}
            onSelectVideo={handleSelectSearchVideo}
            query={query}
            onClearQuery={() => setQuery("")}
            discipline={discipline}
            disciplineLabel={disciplineLabel}
            onClearDiscipline={() => selectDiscipline("all")}
            category={selectedCategory}
            onClearCategory={() => setSelectedCategory("all")}
            year={selectedYear}
            onClearYear={() => setSelectedYear(null)}
            onResetAll={resetSearchFilters}
          />
        ) : filtered.length === 0 ? (
          <TvFilteredEmptyState onShowAll={() => selectDiscipline("all")} />
        ) : (
          <>
            <TvContinueShelf
              ids={historyIds}
              progressById={progressById}
              discipline={discipline}
              activeId={activeId}
              knownById={videoById}
              onResolved={appendRowVideos}
              onSelect={handleSelectShelfVideo}
              onClear={clearHistory}
            />
            <TvNewShelf
              videos={newVideos}
              discipline={discipline}
              activeId={activeId}
              onSelect={handleSelectShelfVideo}
            />
            {categoryRows.map((row) => (
              <TvCategoryMarquee
                key={`${discipline}:${row.category}`}
                category={row.category}
                videos={row.videos}
                initialCursor={row.nextCursor}
                discipline={discipline}
                activeId={activeId}
                onSelect={handleSelect}
                onAppend={appendRowVideos}
                onSeeAll={handleSeeAll}
              />
            ))}
          </>
        )}
      </div>

      {/* Black theater modal */}
      <TvPlayerModal
        isOpen={isModalOpen}
        video={activeVideo}
        disciplineLabel={disciplineLabel}
        categoryLabel={isSearchActive ? null : categoryLabel}
        hasPrev={
          isSearchActive
            ? searchIndex > 0
            : queuePos !== -1
              ? queuePos > 0
              : activeIndex > 0
        }
        hasNext={
          isSearchActive
            ? searchIndex < searchItems.length - 1 || hasMoreSearchResults
            : queuePos !== -1
              ? queuePos < (queueIds?.length ?? 0) - 1
              : activeIndex === -1
                ? theaterQueue.length > 0
                : activeIndex < theaterQueue.length - 1 ||
                  theaterQueue.length < totalForTheaterFilter
        }
        autoplay={isAutoplaying}
        startAt={resume?.id === activeId ? resume.seconds : 0}
        onProgress={trackWatch}
        autoAdvance={autoAdvance}
        onToggleAutoAdvance={() => setAutoAdvance((v) => !v)}
        onClose={handleClose}
        onPrev={isSearchActive ? goPrevSearch : goPrev}
        onNext={isSearchActive ? goNextSearch : goNext}
        onEnded={handleEnded}
        fallbackThumb={pendingThumb}
        fallbackTitle={pendingTitle}
        queue={
          isSearchActive && searchItems.length > 0
            ? searchItems
            : theaterQueue.length > 0
              ? theaterQueue
              : videos
        }
        activeId={activeId}
        onSelectVideo={selectFromQueue}
        theaterCategories={isSearchActive ? [] : theaterCategories}
        theaterCategory={isSearchActive ? undefined : theaterCategory}
        onSelectTheaterCategory={selectTheaterCategory}
        hasMoreQueue={isSearchActive ? hasMoreSearchResults : hasMoreQueue}
        isLoadingQueue={isSearchActive ? isSearchLoadingMore : isLoadingQueue}
        onLoadMoreQueue={
          isSearchActive ? loadMoreSearchResults : handleLoadMoreQueue
        }
      />
    </div>
  );
}
