/* eslint-disable react-hooks/set-state-in-effect -- intentional draft sync */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrickLevel } from "@/lib/schemas/game";

const LEVELS: { value: TrickLevel; label: string }[] = [
  { value: 1, label: "Basic" },
  { value: 2, label: "Intermediate" },
  { value: 3, label: "Advanced" },
  { value: 4, label: "Expert" },
  { value: 5, label: "Master" },
];

// Unified pill tokens — DESIGN.md monochrome, radius-full, label-sm
// Compact on mobile to keep 3 sections in viewport: 11px/1.2 then 12px on sm, reduced padding, consistent border.
const PILL_BASE =
  "inline-flex items-center justify-center rounded-full border font-display text-[11px] font-bold uppercase tracking-[0.05em] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed px-2.5 py-1 sm:px-3 sm:py-1.5 sm:text-xs";
const PILL_ACTIVE = "border-on-surface bg-on-surface text-surface";
const PILL_IDLE = "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low";
const PILL_DISABLED =
  "border-outline-variant bg-surface-container-high text-on-surface-variant opacity-50";

function pillClasses(active: boolean, disabled?: boolean) {
  if (active) return `${PILL_BASE} ${PILL_ACTIVE}`;
  if (disabled) return `${PILL_BASE} ${PILL_DISABLED}`;
  return `${PILL_BASE} ${PILL_IDLE}`;
}

export function ChallengeSettingsFields({
  spotTypes,
  spotType,
  level,
  busy,
  onSpotTypeChange,
  onLevelChange,
  disciplineSlug,
  nextSpotType,
  nextLevel,
  selectedCategories,
  pendingProposal,
  players,
  viewerPlayerId,
  onCategoriesPropose,
  onCategoriesVote,
}: {
  spotTypes: readonly { slug: string; name: string; sortOrder: number }[];
  spotType: string;
  level: TrickLevel;
  busy: boolean;
  onSpotTypeChange: (spotType: string) => void;
  onLevelChange: (level: TrickLevel) => void;
  disciplineSlug?: string;
  nextSpotType?: string;
  nextLevel?: TrickLevel | null;
  selectedCategories?: readonly string[] | null;
  pendingProposal?: {
    categories: readonly string[];
    proposerPlayerId: string;
    votes: readonly {
      playerId: string;
      vote: "pending" | "accepted" | "rejected";
    }[];
    createdAt: string;
  } | null;
  players?: readonly { id: string; displayName: string }[];
  viewerPlayerId?: string | null;
  onCategoriesPropose?: (categories: string[]) => void;
  onCategoriesVote?: (accept: boolean) => void;
}) {
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [allTricks, setAllTricks] = useState<
    { level: number; compatibleSpotTypes: string[]; categories: string[] }[]
  >([]);
  const [draftCategories, setDraftCategories] = useState<string[]>(() =>
    [...(selectedCategories ?? [])].map((c) => c.toLowerCase()),
  );

  useEffect(() => {
    setDraftCategories(
      [...(selectedCategories ?? [])].map((c) => c.toLowerCase()),
    );
  }, [selectedCategories]);

  useEffect(() => {
    if (!disciplineSlug) return;
    let cancelled = false;
    void fetch(
      `/api/games/options?disciplineSlug=${encodeURIComponent(disciplineSlug)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (cancelled || !r.ok) return;
        const cats: string[] = Array.isArray(j.categories) ? j.categories : [];
        const tricks: {
          level: number;
          compatibleSpotTypes: string[];
          categories: string[];
        }[] = Array.isArray(j.tricks) ? j.tricks : [];
        if (!cancelled) {
          setAvailableCategories(cats);
          setAllTricks(tricks);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [disciplineSlug]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of availableCategories) map.set(c.toLowerCase(), 0);
    const lvl = nextLevel ?? level;
    const st = nextSpotType ?? spotType;
    if (allTricks.length > 0 && lvl && st) {
      for (const t of allTricks) {
        if (t.level !== lvl || !t.compatibleSpotTypes.includes(st)) continue;
        for (const c of t.categories)
          map.set(
            String(c).toLowerCase(),
            (map.get(String(c).toLowerCase()) ?? 0) + 1,
          );
      }
    }
    return map;
  }, [
    availableCategories,
    allTricks,
    nextLevel,
    nextSpotType,
    level,
    spotType,
  ]);

  const levelCounts = useMemo(() => {
    const map = new Map<TrickLevel, number>();
    for (const l of LEVELS) map.set(l.value, 0);
    const st = nextSpotType ?? spotType;
    const cats = draftCategories.length > 0 ? new Set(draftCategories) : null;
    if (allTricks.length > 0 && st) {
      for (const t of allTricks) {
        if (!t.compatibleSpotTypes.includes(st)) continue;
        if (
          cats &&
          !t.categories.some((c) => cats.has(String(c).toLowerCase()))
        )
          continue;
        map.set(
          t.level as TrickLevel,
          (map.get(t.level as TrickLevel) ?? 0) + 1,
        );
      }
    }
    return map;
  }, [allTricks, nextSpotType, spotType, draftCategories]);

  const isCategoriesDirty = useMemo(() => {
    const a = [...(selectedCategories ?? [])].map((c) => c.toLowerCase()).sort();
    const b = [...draftCategories].sort();
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
    return false;
  }, [selectedCategories, draftCategories]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <fieldset>
        <legend className="font-display text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary sm:text-xs">
          Where To Ride
        </legend>
        <div
          className="mt-2 flex flex-wrap gap-1.5 sm:gap-2"
          role="radiogroup"
          aria-label="Where To Ride"
        >
          {spotTypes.map((type) => {
            const isActive = spotType === type.slug;
            return (
              <button
                key={type.slug}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={busy}
                onClick={() => onSpotTypeChange(type.slug)}
                className={pillClasses(isActive, busy)}
              >
                {type.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary sm:text-xs">
          How Hard
        </legend>
        <div
          className="mt-2 flex flex-wrap gap-1.5 sm:gap-2"
          role="radiogroup"
          aria-label="How Hard"
        >
          {LEVELS.map((option) => {
            const isActive = level === option.value;
            const count = levelCounts.get(option.value) ?? 0;
            const hasData = Array.from(levelCounts.values()).some((v) => v > 0);
            const zero = hasData && count === 0 && !isActive;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={`${option.label} Level ${option.value}${hasData ? ` (${count})` : ""}`}
                disabled={busy || zero}
                title={
                  zero
                    ? `No tricks for Level ${option.value} at ${nextSpotType ?? spotType}${draftCategories.length > 0 ? ` with ${draftCategories.join(", ")}` : ""}`
                    : hasData
                      ? `${count} trick${count === 1 ? "" : "s"}`
                      : undefined
                }
                onClick={() => onLevelChange(option.value)}
                className={pillClasses(isActive, busy || zero)}
              >
                {option.label} · L{option.value}
                {hasData ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </fieldset>

      {disciplineSlug ? (
        <fieldset>
          <legend className="font-display text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary sm:text-xs">
            Categories
            <span className="ml-1.5 hidden font-sans text-[11px] font-medium normal-case tracking-normal text-on-surface-variant sm:inline">
              · level ∧ spot ∧ categories
            </span>
          </legend>
          <p className="mt-1 text-[11px] leading-4 text-on-surface-variant sm:mt-1.5 sm:text-xs sm:leading-5">
            <span className="sm:hidden">Flexible: solo instant, multi needs consensus.</span>
            <span className="hidden sm:inline">
              Same panel — picking categories updates the current trick immediately when flexible (solo instant, multi needs all active to accept).
            </span>
          </p>
          {pendingProposal ? (
            <div className="mt-2 rounded-[12px] border border-primary bg-surface-container-low px-3 py-2.5 sm:mt-3 sm:rounded-[16px] sm:px-3 sm:py-3">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-primary">
                Proposal:{" "}
                {pendingProposal.categories.length === 0
                  ? "All"
                  : pendingProposal.categories.join(", ")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1 sm:mt-2 sm:gap-1.5">
                {pendingProposal.votes.map((v) => {
                  const p = players?.find((pl) => pl.id === v.playerId);
                  return (
                    <span
                      key={v.playerId}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${v.vote === "accepted" ? "bg-on-surface text-surface" : v.vote === "rejected" ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-secondary"}`}
                    >
                      {p?.displayName ?? v.playerId.slice(0, 4)}: {v.vote}
                    </span>
                  );
                })}
              </div>
              {(() => {
                const my = pendingProposal.votes.find(
                  (v) => v.playerId === viewerPlayerId,
                );
                if (my?.vote === "pending" && onCategoriesVote) {
                  return (
                    <div className="mt-2.5 flex gap-2 sm:mt-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onCategoriesVote(true)}
                        className="rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold uppercase text-on-primary disabled:opacity-50 sm:text-xs"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onCategoriesVote(false)}
                        className="rounded-full border border-outline-variant bg-surface px-4 py-1.5 text-[11px] font-bold uppercase text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50 sm:text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  );
                }
                return (
                  <p className="mt-1.5 text-[11px] text-on-surface-variant sm:mt-2 sm:text-xs">
                    {my?.vote === "accepted"
                      ? "You accepted — waiting for others."
                      : my?.vote === "rejected"
                        ? "You rejected."
                        : "Waiting for votes."}
                  </p>
                );
              })()}
            </div>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                <button
                  type="button"
                  aria-pressed={draftCategories.length === 0}
                  disabled={busy}
                  onClick={() => setDraftCategories([])}
                  className={pillClasses(draftCategories.length === 0, busy)}
                >
                  All
                </button>
                {availableCategories.map((cat) => {
                  const active = draftCategories.includes(cat.toLowerCase());
                  const count = categoryCounts.get(cat.toLowerCase()) ?? 0;
                  const hasData = Array.from(categoryCounts.values()).some(
                    (v) => v > 0,
                  );
                  const zero = hasData && count === 0 && !active;
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={active}
                      disabled={busy || zero}
                      title={
                        zero
                          ? `No tricks for ${cat} at Level ${nextLevel ?? level} ${nextSpotType ?? spotType}`
                          : hasData
                            ? `${count} trick${count === 1 ? "" : "s"}`
                            : undefined
                      }
                      onClick={() =>
                        setDraftCategories((prev) =>
                          active
                            ? prev.filter((c) => c !== cat.toLowerCase())
                            : [...prev, cat.toLowerCase()].sort(),
                        )
                      }
                      className={pillClasses(active, busy || zero)}
                    >
                      {cat} {hasData ? `(${count})` : ""}
                    </button>
                  );
                })}
              </div>
              {onCategoriesPropose ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3">
                  <button
                    type="button"
                    disabled={busy || !isCategoriesDirty}
                    onClick={() => onCategoriesPropose(draftCategories)}
                    className="rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-bold uppercase text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-1.5 sm:text-xs"
                    aria-label="Apply categories"
                  >
                    Apply
                  </button>
                  <span className="text-[11px] leading-4 text-on-surface-variant sm:text-xs">
                    {isCategoriesDirty ? (
                      <>
                        <span className="hidden sm:inline">
                          {draftCategories.length === 0 ? "All" : draftCategories.join(", ")} ·{" "}
                        </span>
                        {selectedCategories?.length === 0 || !selectedCategories ? "All → " : ""}
                        {draftCategories.length === 0 ? "All" : draftCategories.join(", ")}
                        <span className="hidden sm:inline"> · solo instant, multi consensus</span>
                        <span className="sm:hidden"> · tap Apply</span>
                      </>
                    ) : (
                      <span>
                        {draftCategories.length === 0 ? "All" : draftCategories.join(", ")} · up to date
                      </span>
                    )}
                  </span>
                  {isCategoriesDirty ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setDraftCategories(
                          [...(selectedCategories ?? [])].map((c) => c.toLowerCase()),
                        )
                      }
                      className="ml-auto text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary underline decoration-outline-variant underline-offset-4 hover:text-on-surface sm:text-xs"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </fieldset>
      ) : null}
    </div>
  );
}
