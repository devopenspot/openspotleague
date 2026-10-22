"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { TvCategoryRow } from "@/lib/services/tv/tv";
import {
  resolveDisciplineParam,
  withDisciplineParam,
} from "@/components/tv/marquee/tv-marquee-data";

export interface UseTvDisciplineStateProps {
  rows: readonly TvCategoryRow[];
  disciplines: readonly { slug: string; name: string }[];
  initialDiscipline?: string | null;
  onDisciplineChange?: () => void;
  playParam?: string | null;
}

export function useTvDisciplineState({
  rows,
  disciplines,
  initialDiscipline = null,
  onDisciplineChange,
  playParam: _playParam,
}: UseTvDisciplineStateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const preferredSport = usePreferencesStore((s) => s.preferredSport);
  const hydrationStatus = usePreferencesStore((s) => s.hydrationStatus);

  const disciplineListRef = useRef<HTMLDivElement>(null);
  const manualSlugRef = useRef<string | null>(null);
  const pendingManualRef = useRef<string | null | undefined>(undefined);
  const prevUrlParamRef = useRef<string | null | undefined>(undefined);
  const prevSportRef = useRef<string | null>(null);
  const sportInitRef = useRef(false);
  const awaitingSaveRef = useRef(false);
  const canonicalizedRef = useRef(false);
  const prevRowsRef = useRef(rows);

  const validInitial =
    initialDiscipline &&
    (initialDiscipline.toLowerCase() === "all" ||
      disciplines.some(
        (d) => d.slug.toLowerCase() === initialDiscipline.toLowerCase(),
      ))
      ? initialDiscipline.toLowerCase()
      : null;

  const [discipline, setDiscipline] = useState<string>(validInitial ?? "all");
  const [pendingDiscipline, setPendingDiscipline] = useState<string | null>(null);

  const selectDiscipline = useCallback(
    (slug: string) => {
      if (slug === discipline) return;
      setDiscipline(slug);
      setPendingDiscipline(slug);
      onDisciplineChange?.();
      manualSlugRef.current = slug;
      pendingManualRef.current = slug;
      if (typeof window !== "undefined") {
        const next = withDisciplineParam(pathname, window.location.search, slug);
        window.history.replaceState(null, "", next);
        startTransition(() => {
          router.replace(next, { scroll: false });
        });
      }
    },
    [discipline, pathname, router, onDisciplineChange],
  );

  // Fresh server payload landed — any pending switch is resolved.
  useEffect(() => {
    if (prevRowsRef.current === rows) return;
    prevRowsRef.current = rows;
    setPendingDiscipline(null);
  }, [rows]);

  // Safety net — an offline/slow refetch must never stick the loader.
  useEffect(() => {
    if (!pendingDiscipline) return;
    const t = window.setTimeout(() => setPendingDiscipline(null), 3000);
    return () => window.clearTimeout(t);
  }, [pendingDiscipline]);

  // Derive ?discipline= as a stable string
  const urlDiscipline = searchParams.get("discipline") ?? null;

  // Expire manual pill intent on external URL changes and resolve pending switch on land
  useEffect(() => {
    const prev = prevUrlParamRef.current;
    prevUrlParamRef.current = urlDiscipline;
    if (prev === undefined) return;
    if (urlDiscipline === prev) return;
    const pending = pendingManualRef.current;
    if (pending !== undefined && pending === urlDiscipline) {
      pendingManualRef.current = undefined;
      setPendingDiscipline(null);
      return;
    }
    manualSlugRef.current = null;
  }, [urlDiscipline]);

  // Back/forward sync — URL is source of truth
  useEffect(() => {
    if (!urlDiscipline) return;
    // Shield our own pending manual click from lagging searchParams while in-flight
    if (
      pendingManualRef.current !== undefined &&
      urlDiscipline !== pendingManualRef.current
    ) {
      return;
    }
    const resolved =
      resolveDisciplineParam(
        urlDiscipline,
        disciplines.map((d) => d.slug),
      ) ?? "all";
    if (resolved === discipline) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- back/forward sync is intentional
    setDiscipline(resolved);
  }, [urlDiscipline, disciplines, discipline]);

  // Sync browser back/forward history events directly
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const search = window.location.search;
      const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
      const discParam = params.get("discipline");
      const resolved =
        resolveDisciplineParam(
          discParam,
          disciplines.map((d) => d.slug),
        ) ?? "all";
      if (resolved !== discipline) {
        setDiscipline(resolved);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [disciplines, discipline]);

  // Authoritative discipline convergence
  useEffect(() => {
    if (hydrationStatus !== "ready" && hydrationStatus !== "error") return;
    const clientSport = preferredSport === "all" ? "all" : preferredSport ? preferredSport.toLowerCase() : null;
    if (!sportInitRef.current) {
      sportInitRef.current = true;
      prevSportRef.current = clientSport;
    } else {
      const justSet =
        awaitingSaveRef.current &&
        !!clientSport &&
        prevSportRef.current !== clientSport;
      prevSportRef.current = clientSport;
      if (justSet && clientSport && clientSport !== discipline) {
        awaitingSaveRef.current = false;
        selectDiscipline(clientSport);
        return;
      }
      if (justSet) {
        awaitingSaveRef.current = false;
      }
    }
    if (urlDiscipline) return;
    const authoritative = validInitial ?? clientSport;
    if (!authoritative) return;
    const isAll = authoritative === "all";
    if (!isAll && !disciplines.some((d) => d.slug.toLowerCase() === authoritative))
      return;
    if (manualSlugRef.current !== null && manualSlugRef.current === discipline)
      return;
    if (authoritative !== discipline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- converging to preference is intentional
      selectDiscipline(authoritative);
    }
  }, [
    hydrationStatus,
    preferredSport,
    validInitial,
    urlDiscipline,
    disciplines,
    discipline,
    selectDiscipline,
  ]);

  // Mount canonicalization
  useEffect(() => {
    if (canonicalizedRef.current) return;
    canonicalizedRef.current = true;
    if (typeof window === "undefined") return;
    if (searchParams.get("discipline")) return;
    if (discipline === "all") return;
    const next = withDisciplineParam(pathname, window.location.search, discipline);
    window.history.replaceState(null, "", next);
  }, [discipline, pathname, searchParams]);

  // Centering selected discipline pill
  useEffect(() => {
    const container = disciplineListRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `[data-slug="${discipline}"]`,
    );
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
    container.scrollTo({
      left: Math.max(0, left),
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }, [discipline]);

  const sortedDisciplines = useMemo(() => [...disciplines], [disciplines]);

  const disciplineLabel = useMemo(() => {
    if (discipline === "all") return "All sports";
    const found = disciplines.find((d) => d.slug === discipline);
    return found?.name ?? discipline;
  }, [discipline, disciplines]);

  return {
    discipline,
    pendingDiscipline,
    selectDiscipline,
    disciplineListRef,
    sortedDisciplines,
    disciplineLabel,
  };
}
