import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { TvCard, TvCategory } from "@/types/tv";
import type { TvCategoryRow } from "@/lib/services/tv/tv";
import { orderTvRows } from "@/components/tv/marquee/tv-marquee-data";

export function useTvCatalogState({
  rows,
  discipline,
  initialPlayVideo,
}: {
  rows: readonly TvCategoryRow[];
  discipline: string;
  initialPlayVideo?: TvCard | null;
}) {
  // Appended videos strictly per category row (preserves keyset cursor order)
  const [appendedByCategory, setAppendedByCategory] = useState<
    Record<string, readonly TvCard[]>
  >({});
  const [updatedCursors, setUpdatedCursors] = useState<Record<string, string | null>>({});
  // Uncategorized extra cards (e.g. loaded via deep-link or queue boundary walk)
  const [extraCards, setExtraCards] = useState<readonly TvCard[]>([]);

  // Reset appended state when discipline filter changes
  const resetAppends = useCallback(() => {
    setAppendedByCategory({});
    setUpdatedCursors({});
    setExtraCards([]);
  }, []);

  // In-memory cache of discipline rows to ensure 0ms instant tab switching
  const [cachedRowsByDiscipline, setCachedRowsByDiscipline] = useState<
    Record<string, readonly TvCategoryRow[]>
  >(() => (rows && rows.length > 0 ? { [discipline]: rows } : {}));

  // Adjust state during render when rows prop changes (React recommended pattern)
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    if (rows && rows.length > 0) {
      setCachedRowsByDiscipline((prev) => ({
        ...prev,
        [discipline]: rows,
      }));
    }
  }

  const prevDisciplineRef = useRef(discipline);
  useEffect(() => {
    if (prevDisciplineRef.current !== discipline) {
      prevDisciplineRef.current = discipline;
      resetAppends();
    }
  }, [discipline, resetAppends]);

  const appendRowVideos = useCallback(
    (
      newVideos: readonly TvCard[],
      category?: TvCategory,
      nextCursor?: string | null,
    ) => {
      if (category && nextCursor !== undefined) {
        setUpdatedCursors((prev) => ({ ...prev, [category]: nextCursor }));
      }
      if (category && newVideos.length > 0) {
        setAppendedByCategory((prev) => {
          const current = prev[category] ?? [];
          const seen = new Set(current.map((v) => v.id));
          const toAdd = newVideos.filter((v) => !seen.has(v.id));
          if (toAdd.length === 0) return prev;
          return { ...prev, [category]: [...current, ...toAdd] };
        });
      } else if (!category && newVideos.length > 0) {
        setExtraCards((prev) => {
          const seen = new Set(prev.map((v) => v.id));
          const toAdd = newVideos.filter((v) => !seen.has(v.id));
          if (toAdd.length === 0) return prev;
          return [...prev, ...toAdd];
        });
      }
    },
    [],
  );

  // Rows with per-category appended pages merged.
  const categoryRows = useMemo(() => {
    const activeRows = cachedRowsByDiscipline[discipline] ?? rows;
    const needle = discipline === "all" ? null : discipline.toLowerCase();
    const matches = (v: TvCard) =>
      !needle || v.disciplineSlug.toLowerCase() === needle;

    return orderTvRows(activeRows).map((row) => {
      const base = row.videos.filter(matches);
      const appended = (appendedByCategory[row.category] ?? []).filter(matches);
      const effectiveCursor =
        updatedCursors[row.category] !== undefined
          ? updatedCursors[row.category]!
          : row.nextCursor;

      if (appended.length === 0) {
        return {
          ...row,
          videos: base,
          nextCursor: effectiveCursor,
        };
      }
      const seen = new Set(base.map((v) => v.id));
      const merged = [...base];
      for (const v of appended) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          merged.push(v);
        }
      }
      return {
        ...row,
        videos: merged,
        nextCursor: effectiveCursor,
      };
    });
  }, [rows, appendedByCategory, updatedCursors, discipline, cachedRowsByDiscipline]);

  // Loaded videos for theater lookup & queue
  const videos = useMemo(() => {
    const seen = new Set<string>();
    const out: TvCard[] = [];
    if (initialPlayVideo) {
      seen.add(initialPlayVideo.id);
      out.push(initialPlayVideo);
    }
    for (const row of rows) {
      for (const v of row.videos) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          out.push(v);
        }
      }
    }
    for (const appended of Object.values(appendedByCategory)) {
      for (const v of appended) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          out.push(v);
        }
      }
    }
    for (const v of extraCards) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        out.push(v);
      }
    }
    return out;
  }, [rows, appendedByCategory, extraCards, initialPlayVideo]);

  const videoById = useMemo(
    () => new Map(videos.map((v) => [v.id, v] as const)),
    [videos],
  );

  return {
    categoryRows,
    videos,
    videoById,
    updatedCursors,
    appendRowVideos,
    resetAppends,
  };
}
