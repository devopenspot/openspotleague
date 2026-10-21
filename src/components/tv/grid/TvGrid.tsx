"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tv } from "lucide-react";
import type { TvCard } from "@/types/tv";
import type { TvCategoryRow } from "@/lib/services/tv/tv";
import { TvAutoplayerButton } from "@/components/tv/player/TvAutoplayerButton";
import { TvPlayerModal } from "@/components/tv/player/TvPlayerModal";
import { TvCategoryMarquee } from "@/components/tv/marquee/TvCategoryMarquee";
import { TvDisciplineSwitchingSkeleton } from "./TvDisciplineSwitchingSkeleton";
import { useTvCatalogState } from "./use-tv-catalog-state";
import { useTvDisciplineState } from "./use-tv-discipline-state";
import { useTvTheaterQueue } from "./use-tv-theater-queue";
import {
  TvDisciplinePills,
  TvGenericEmptyState,
  TvFilteredEmptyState,
} from "./tv-grid-parts";

const AUTO_ADVANCE_KEY = "tv:autoAdvance";

export function TvGrid({
  rows,
  disciplines,
  initialDiscipline = null,
  initialPlayVideo = null,
}: {
  rows: readonly TvCategoryRow[];
  disciplineCounts?: Readonly<Record<string, number>>;
  disciplines: readonly { slug: string; name: string }[];
  initialDiscipline?: string | null;
  initialPlayVideo?: TvCard | null;
}) {
  const searchParams = useSearchParams();
  const playParam = searchParams.get("play") ?? searchParams.get("v") ?? null;
  const pendingThumb = searchParams.get("thumb");
  const pendingTitle = searchParams.get("title");

  const [activeId, setActiveId] = useState<string | null>(
    () => initialPlayVideo?.id ?? null,
  );
  const [isAutoplaying, setIsAutoplaying] = useState(() =>
    Boolean(initialPlayVideo),
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

  const openWithId = useCallback(
    (
      id: string,
      autoplay: boolean,
      thumb?: string | null,
      title?: string | null,
    ) => {
      setActiveId(id);
      setIsAutoplaying(autoplay);
      syncUrl(id, { thumb, title });
    },
    [syncUrl],
  );

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

  const handleAutoplay = useCallback(() => {
    const first = theaterQueue[0] ?? filtered[0];
    if (!first) return;
    setAutoAdvance(true);
    openWithId(first.id, true);
  }, [theaterQueue, filtered, openWithId]);

  const handleSelect = useCallback(
    (video: TvCard, category?: string) => {
      if (category) {
        setTheaterCategory(category);
      }
      openWithId(video.id, autoAdvance);
    },
    [openWithId, autoAdvance, setTheaterCategory],
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
  }, [syncUrl, resetTheaterCategory]);

  const handleEnded = useCallback(() => {
    if (!autoAdvance) return;
    goNext();
  }, [autoAdvance, goNext]);

  const activeVideo = useMemo(() => {
    if (!activeId) return null;
    return videoById.get(activeId) ?? null;
  }, [videoById, activeId]);

  const isModalOpen = Boolean(activeVideo);
  const hasVideos = rows.length > 0;
  const showGenericEmpty = !hasVideos && discipline === "all";

  return (
    <div className="min-w-0 space-y-2 sm:space-y-4 overflow-x-hidden px-3">
      {/* Background container — suspended and hidden from compositor when modal is active */}
      <div
        aria-hidden={isModalOpen ? true : undefined}
        inert={isModalOpen ? true : undefined}
        style={{ visibility: isModalOpen ? "hidden" : "visible" }}
        className="space-y-2 sm:space-y-4"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 md:gap-6 lg:gap-8">
          <div className="flex items-center justify-between w-full gap-3 sm:gap-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Tv
                size={32}
                className="h-8 w-8 sm:h-10 sm:w-10 text-white"
                aria-hidden="true"
              />
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white">
                TV
              </h1>
            </div>
            <TvAutoplayerButton
              count={totalForTheaterFilter}
              disciplineLabel={disciplineLabel}
              categoryLabel={categoryLabel}
              onOpen={handleAutoplay}
              disabled={totalForTheaterFilter === 0}
            />
          </div>

          <div className="flex items-center gap-6 md:gap-8">
            <div className="space-y-2 sm:space-y-2.5 min-w-0">
              <TvDisciplinePills
                listRef={disciplineListRef}
                disciplines={sortedDisciplines}
                selected={discipline}
                onSelect={selectDiscipline}
              />
            </div>
          </div>
        </div>

        {showGenericEmpty ? (
          <TvGenericEmptyState />
        ) : pendingDiscipline ? (
          <TvDisciplineSwitchingSkeleton
            label={`Loading ${
              pendingDiscipline === "all"
                ? "all sports"
                : (disciplines.find((d) => d.slug === pendingDiscipline)
                    ?.name ?? pendingDiscipline)
            } sessions…`}
          />
        ) : filtered.length === 0 ? (
          <TvFilteredEmptyState
            onClearFilters={() => selectDiscipline("all")}
          />
        ) : (
          categoryRows.map((row) => (
            <TvCategoryMarquee
              key={`${discipline}:${row.category}`}
              category={row.category}
              videos={row.videos}
              initialCursor={row.nextCursor}
              discipline={discipline}
              activeId={activeId}
              onSelect={handleSelect}
              onAppend={appendRowVideos}
            />
          ))
        )}
      </div>

      {/* Black theater modal */}
      <TvPlayerModal
        isOpen={isModalOpen}
        video={activeVideo}
        disciplineLabel={disciplineLabel}
        categoryLabel={categoryLabel}
        hasPrev={queuePos !== -1 ? queuePos > 0 : activeIndex > 0}
        hasNext={
          queuePos !== -1
            ? queuePos < (queueIds?.length ?? 0) - 1
            : activeIndex === -1
              ? theaterQueue.length > 0
              : activeIndex < theaterQueue.length - 1 ||
                theaterQueue.length < totalForTheaterFilter
        }
        autoplay={isAutoplaying}
        autoAdvance={autoAdvance}
        onToggleAutoAdvance={() => setAutoAdvance((v) => !v)}
        onClose={handleClose}
        onPrev={goPrev}
        onNext={goNext}
        onEnded={handleEnded}
        fallbackThumb={pendingThumb}
        fallbackTitle={pendingTitle}
        queue={theaterQueue.length > 0 ? theaterQueue : videos}
        activeId={activeId}
        onSelectVideo={selectFromQueue}
        theaterCategories={theaterCategories}
        theaterCategory={theaterCategory}
        onSelectTheaterCategory={selectTheaterCategory}
        hasMoreQueue={hasMoreQueue}
        isLoadingQueue={isLoadingQueue}
        onLoadMoreQueue={handleLoadMoreQueue}
      />
    </div>
  );
}
