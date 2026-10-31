"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TvCard } from "@/types/tv";
import type { TvCardPageResult } from "@/lib/repositories/tv/tv-repository";
import { fetchWithTimeout } from "@/lib/utils/fetch-timeout";

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PAGE_LIMIT = 24;

export interface UseTvSearchStateProps {
  discipline: string;
  initialQuery?: string | null;
  initialCategory?: string | null;
  initialYear?: number | null;
  initialSearchResults?: TvCardPageResult | null;
}

export function useTvSearchState({
  discipline,
  initialQuery = null,
  initialCategory = null,
  initialYear = null,
  initialSearchResults = null,
}: UseTvSearchStateProps) {
  const [query, setQuery] = useState<string>(() => initialQuery ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState<string>(
    () => initialQuery ?? "",
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => (initialCategory && initialCategory !== "all" ? initialCategory : "all"),
  );
  const [selectedYear, setSelectedYear] = useState<number | null>(
    () => initialYear ?? null,
  );

  // Debounce text query input
  useEffect(() => {
    if (query === debouncedQuery) return;
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, debouncedQuery]);

  const isSearchActive = Boolean(
    debouncedQuery.trim() ||
      (selectedCategory && selectedCategory !== "all") ||
      selectedYear !== null,
  );

  // Initialize with SSR results if available
  const initialKey = `${discipline}:${selectedCategory}:${selectedYear ?? "all"}:${debouncedQuery.trim().toLowerCase()}`;

  // In-memory query result cache: key -> { items, nextCursor }
  const cacheRef = useRef<
    Map<string, { items: readonly TvCard[]; nextCursor: string | null }>
  >(
    initialSearchResults
      ? new Map([
          [
            initialKey,
            {
              items: initialSearchResults.items,
              nextCursor: initialSearchResults.nextCursor,
            },
          ],
        ])
      : new Map(),
  );

  const lastFetchedKeyRef = useRef<string>(
    initialSearchResults ? initialKey : "",
  );

  const [items, setItems] = useState<readonly TvCard[]>(
    () => initialSearchResults?.items ?? [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    () => initialSearchResults?.nextCursor ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Sync state to URL via window.history.replaceState (avoids Next.js RSC refetches)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const params = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );

    const trimmed = debouncedQuery.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");

    if (selectedCategory && selectedCategory !== "all") {
      params.set("category", selectedCategory);
    } else {
      params.delete("category");
    }

    if (selectedYear !== null) {
      params.set("year", String(selectedYear));
    } else {
      params.delete("year");
    }

    const qs = params.toString();
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, [debouncedQuery, selectedCategory, selectedYear]);

  // Back/forward navigation sync
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const search = window.location.search;
      const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
      const q = params.get("q") ?? "";
      const cat = params.get("category") ?? "all";
      const yrStr = params.get("year");
      const yr = yrStr ? Number(yrStr) : null;
      setQuery(q);
      setDebouncedQuery(q);
      setSelectedCategory(cat);
      setSelectedYear(yr && !Number.isNaN(yr) ? yr : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Fetch search results whenever search dimensions change
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isSearchActive) return;

    const cacheKey = `${discipline}:${selectedCategory}:${selectedYear ?? "all"}:${debouncedQuery.trim().toLowerCase()}`;

    // Skip if already matching the current fetched query
    if (lastFetchedKeyRef.current === cacheKey) {
      return;
    }

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      lastFetchedKeyRef.current = cacheKey;
      setItems(cached.items);
      setNextCursor(cached.nextCursor);
      setIsLoading(false);
      return;
    }

    lastFetchedKeyRef.current = cacheKey;
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;
    setIsLoading(true);

    const params = new URLSearchParams();
    params.set("limit", String(SEARCH_PAGE_LIMIT));
    if (discipline && discipline !== "all") {
      params.set("discipline", discipline);
    }
    if (selectedCategory && selectedCategory !== "all") {
      params.set("category", selectedCategory);
    }
    if (selectedYear !== null) {
      params.set("year", String(selectedYear));
    }
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    }

    void (async () => {
      try {
        const res = await fetchWithTimeout(`/api/tv?${params.toString()}`, {
          signal: ac.signal,
          timeoutMs: 10_000,
        });
        if (ac.signal.aborted) {
          if (lastFetchedKeyRef.current === cacheKey) {
            lastFetchedKeyRef.current = "";
          }
          return;
        }
        if (!res.ok) {
          if (lastFetchedKeyRef.current === cacheKey) {
            lastFetchedKeyRef.current = "";
          }
          setItems([]);
          setNextCursor(null);
          return;
        }
        const data = (await res.json()) as {
          items?: TvCard[];
          nextCursor?: string | null;
        };
        if (ac.signal.aborted) {
          if (lastFetchedKeyRef.current === cacheKey) {
            lastFetchedKeyRef.current = "";
          }
          return;
        }

        const newItems = Array.isArray(data.items) ? data.items : [];
        const newCursor =
          typeof data.nextCursor === "string" ? data.nextCursor : null;

        cacheRef.current.set(cacheKey, {
          items: newItems,
          nextCursor: newCursor,
        });

        setItems(newItems);
        setNextCursor(newCursor);
      } catch (err) {
        if (lastFetchedKeyRef.current === cacheKey) {
          lastFetchedKeyRef.current = "";
        }
        if ((err as { name?: string })?.name === "AbortError") return;
        setItems([]);
        setNextCursor(null);
      } finally {
        if (abortControllerRef.current === ac) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [isSearchActive, discipline, selectedCategory, selectedYear, debouncedQuery]);

  // Load more pages for search results
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !nextCursor || !isSearchActive) return;
    setIsLoadingMore(true);

    const params = new URLSearchParams();
    params.set("limit", String(SEARCH_PAGE_LIMIT));
    params.set("cursor", nextCursor);
    if (discipline && discipline !== "all") {
      params.set("discipline", discipline);
    }
    if (selectedCategory && selectedCategory !== "all") {
      params.set("category", selectedCategory);
    }
    if (selectedYear !== null) {
      params.set("year", String(selectedYear));
    }
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    }

    try {
      const res = await fetchWithTimeout(`/api/tv?${params.toString()}`, {
        timeoutMs: 10_000,
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: TvCard[];
        nextCursor?: string | null;
      };
      const fetchedItems = Array.isArray(data.items) ? data.items : [];
      const updatedCursor =
        typeof data.nextCursor === "string" ? data.nextCursor : null;

      setItems((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        const merged = [...prev, ...fetchedItems.filter((v) => !seen.has(v.id))];
        const cacheKey = `${discipline}:${selectedCategory}:${selectedYear ?? "all"}:${debouncedQuery.trim().toLowerCase()}`;
        cacheRef.current.set(cacheKey, {
          items: merged,
          nextCursor: updatedCursor,
        });
        return merged;
      });
      setNextCursor(updatedCursor);
    } catch {
      // transient network error
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    nextCursor,
    isSearchActive,
    discipline,
    selectedCategory,
    selectedYear,
    debouncedQuery,
  ]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setSelectedCategory("all");
    setSelectedYear(null);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    selectedCategory,
    setSelectedCategory,
    selectedYear,
    setSelectedYear,
    isSearchActive,
    items,
    nextCursor,
    isLoading,
    isLoadingMore,
    hasMore: Boolean(nextCursor),
    loadMore,
    resetFilters,
  };
}
