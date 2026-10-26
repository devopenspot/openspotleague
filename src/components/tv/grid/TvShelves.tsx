"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { TV_CARD_BATCH_MAX, type TvCard } from "@/types/tv";
import { TvCategoryMarquee } from "@/components/tv/marquee/TvCategoryMarquee";

const noopAppend = () => {};

function matchesDiscipline(video: TvCard, discipline: string) {
  return discipline === "all" || video.disciplineSlug.toLowerCase() === discipline;
}

/**
 * Single-page, non-paginated shelf (no category semantics): reuses the
 * row visuals but never fetches more pages and never changes the theater
 * category when a card is selected.
 */
const TvShelf = memo(function TvShelf({
  title,
  videos,
  activeId,
  onSelect,
  headerAction,
}: {
  title: string;
  videos: readonly TvCard[];
  activeId: string | null;
  onSelect: (video: TvCard) => void;
  headerAction?: React.ReactNode;
}) {
  const handleSelect = useCallback(
    (video: TvCard) => onSelect(video),
    [onSelect],
  );
  return (
    <TvCategoryMarquee
      category={title}
      videos={videos}
      initialCursor={null}
      discipline="all"
      activeId={activeId}
      onSelect={handleSelect}
      onAppend={noopAppend}
      headerAction={headerAction}
    />
  );
});

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * "New this week" — videos recently added to OpenSpot, server-provided and
 * shown in a random order. The shuffle runs after mount (not during render)
 * so the server HTML and first client render match and the CDN-cached
 * response stays identical for everyone.
 */
export function TvNewShelf({
  videos,
  discipline,
  activeId,
  onSelect,
}: {
  videos: readonly TvCard[];
  discipline: string;
  activeId: string | null;
  onSelect: (video: TvCard) => void;
}) {
  const [ordered, setOrdered] = useState<readonly TvCard[]>(videos);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount shuffle avoids hydration mismatch
    setOrdered(shuffled(videos));
  }, [videos]);

  const visible = useMemo(
    () => ordered.filter((v) => matchesDiscipline(v, discipline)),
    [ordered, discipline],
  );
  if (visible.length === 0) return null;
  return (
    <TvShelf
      title="New this week"
      videos={visible}
      activeId={activeId}
      onSelect={onSelect}
    />
  );
}

/**
 * "Continue watching" — recently watched ids (localStorage) resolved to
 * cards via the cached batch endpoint (max `TV_CARD_BATCH_MAX` per call).
 */
export function TvContinueShelf({
  ids,
  discipline,
  activeId,
  knownById,
  onResolved,
  onSelect,
  onClear,
}: {
  ids: readonly string[];
  discipline: string;
  activeId: string | null;
  knownById: ReadonlyMap<string, TvCard>;
  /** Registers resolved cards so the theater can open them. */
  onResolved: (cards: readonly TvCard[]) => void;
  onSelect: (video: TvCard) => void;
  onClear: () => void;
}) {
  const [fetched, setFetched] = useState<ReadonlyMap<string, TvCard>>(
    () => new Map(),
  );
  const idsKey = ids.join(",");

  useEffect(() => {
    const missing = ids.filter((id) => !knownById.has(id) && !fetched.has(id));
    if (missing.length === 0) return;
    const ac = new AbortController();
    void (async () => {
      const found: TvCard[] = [];
      for (let i = 0; i < missing.length; i += TV_CARD_BATCH_MAX) {
        const chunk = missing.slice(i, i + TV_CARD_BATCH_MAX);
        try {
          const res = await fetch(`/api/tv?ids=${chunk.join(",")}`, {
            signal: ac.signal,
          });
          if (!res.ok) continue;
          const data = (await res.json()) as { cards?: TvCard[] };
          if (Array.isArray(data.cards)) found.push(...data.cards);
        } catch {
          if (ac.signal.aborted) return;
        }
      }
      if (ac.signal.aborted || found.length === 0) return;
      setFetched((prev) => {
        const next = new Map(prev);
        for (const c of found) next.set(c.id, c);
        return next;
      });
      onResolved(found);
    })();
    return () => ac.abort();
    // `ids` is covered by idsKey; `fetched`/`knownById` intentionally omitted
    // so a successful fetch does not re-trigger itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, onResolved]);

  const cards = useMemo(() => {
    const out: TvCard[] = [];
    for (const id of ids) {
      const card = knownById.get(id) ?? fetched.get(id);
      if (card && matchesDiscipline(card, discipline)) out.push(card);
    }
    return out;
  }, [ids, knownById, fetched, discipline]);

  const clearButton = useMemo(
    () => (
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-medium text-white/50 hover:text-white transition-colors"
      >
        Clear
      </button>
    ),
    [onClear],
  );

  if (cards.length === 0) return null;
  return (
    <TvShelf
      title="Continue watching"
      videos={cards}
      activeId={activeId}
      onSelect={onSelect}
      headerAction={clearButton}
    />
  );
}
