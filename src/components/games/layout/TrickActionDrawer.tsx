"use client";

import { Check, X, Zap, Clock3, RotateCcw } from "lucide-react";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import type { GameState } from "@/lib/schemas/game";
import type { Result } from "./header-state";

export const TRICK_DRAWER_ID = "trick-action-drawer";
export const TRICK_DRAWER_TITLE_ID = "trick-drawer-title";

type TrickRound = NonNullable<GameState["currentRound"]>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  game: GameState | null;
  current: TrickRound | null | undefined;
  disciplineSlug: string | null;
  effectiveLevel: number | null;
  levelLabel: string | null;
  isWaitingForOthers: boolean;
  pendingCount: number;
  pendingNames: string[];
  canAdvanceToNextTrick: boolean;
  alternativeTricksRemaining: number;
  busy: boolean;
  resultAction: { label: string; onSelect: (r: Result) => void } | null;
  onNextTrick: () => void;
};

export function TrickActionDrawer({
  isOpen,
  onClose,
  game,
  current,
  disciplineSlug,
  effectiveLevel,
  levelLabel,
  isWaitingForOthers,
  pendingCount,
  pendingNames,
  canAdvanceToNextTrick,
  alternativeTricksRemaining,
  busy,
  resultAction,
  onNextTrick,
}: Props) {
  const trickName = current?.trickName ?? "Setting Up Your Line";
  const trickDescription = current?.trickDescription ?? null;
  const spotType = current?.spotType ?? game?.nextSpotType ?? "—";
  const roundSeq =
    current?.sequence ??
    (game?.stageLedger?.length ? game.stageLedger.length + 1 : 1);
  const isChallengePending = current?.status === "challenge_open";
  const stateLabel = isWaitingForOthers
    ? `Waiting · ${pendingCount} rider${pendingCount === 1 ? "" : "s"}`
    : (resultAction?.label ??
      (isChallengePending ? "Challenger — Set the line" : "Trick delivered"));
  const stateTone = isWaitingForOthers
    ? "pending"
    : resultAction
      ? "live"
      : "idle";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={TRICK_DRAWER_TITLE_ID}
      contentId={TRICK_DRAWER_ID}
      testId={TRICK_DRAWER_ID}
      panelClassName="w-[min(24rem,calc(100vw-1rem))] sm:w-[min(28rem,28rem)] rounded-l-[16px] border-l border-outline-variant bg-surface-container-lowest"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* cabinet header — mono, hierarchy: round+discipline kicker, trick as title, state as subtitle */}
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant bg-on-surface px-4 py-3.5 text-surface sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-surface/70">
              <span
                className={`h-1.5 w-1.5 rounded-full ${stateTone === "live" ? "bg-permission-granted shadow-[0_0_6px_rgba(22,163,74,0.7)]" : stateTone === "pending" ? "bg-permission-pending" : "bg-surface/40"}`}
                aria-hidden
              />
              Round {roundSeq} · {disciplineSlug ?? "—"}{" "}
              {effectiveLevel ? `· Level ${effectiveLevel}` : ""}{" "}
              {spotType !== "—" ? `· ${spotType}` : ""}
            </p>
            <h2
              id={TRICK_DRAWER_TITLE_ID}
              className="mt-1 line-clamp-2 font-display text-xl font-bold leading-tight tracking-[-0.015em] sm:text-2xl"
            >
              {trickName}
            </h2>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-surface/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-surface/80">
              <span
                className={`h-1.5 w-1.5 rounded-full ${stateTone === "live" ? "bg-primary" : stateTone === "pending" ? "bg-permission-pending -dot" : "bg-surface/40"}`}
                aria-hidden
              />
              {stateLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trick panel"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface/20 bg-surface/10 text-surface hover:bg-surface/15 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3.5 p-3.5 sm:space-y-4 sm:p-4">
            {/* trick meta card — panel bezel */}
            <section
              aria-labelledby="trick-drawer-meta"
              className="overflow-hidden rounded-[14px] border-[1.5px] border-on-surface bg-on-surface p-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            >
              <div className="rounded-[12px] border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 font-display text-xs font-bold uppercase tracking-[0.05em]">
                    <Zap size={12} aria-hidden />
                    {spotType}
                  </span>
                  {effectiveLevel && levelLabel ? (
                    <span className="inline-flex items-center rounded-full bg-primary-container px-2.5 py-1 font-display text-xs font-bold text-on-primary-container">
                      Level {effectiveLevel} · {levelLabel}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">
                    {disciplineSlug ?? "—"} deck
                  </span>
                </div>

                <div className="mt-3">
                  <p
                    id="trick-drawer-meta"
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-secondary"
                  >
                    {isChallengePending
                      ? "Challenger — Set the line"
                      : "Respond — Match it"}
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-on-surface">
                    {trickName}
                  </h3>
                  {trickDescription ? (
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      {trickDescription}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      New trick is live — check the description and drop when
                      ready.
                    </p>
                  )}
                </div>

                {/* next trick control — flexible mode only */}
                <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-outline-variant bg-surface-container-low px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
                      Next trick
                    </p>
                    <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface">
                      {canAdvanceToNextTrick
                        ? `${alternativeTricksRemaining} left this round`
                        : "No more next tricks"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onNextTrick}
                    disabled={
                      busy ||
                      !canAdvanceToNextTrick ||
                      alternativeTricksRemaining === 0
                    }
                    aria-label={
                      alternativeTricksRemaining > 0
                        ? `Get next trick, ${alternativeTricksRemaining} left`
                        : "No more next tricks"
                    }
                    title={
                      alternativeTricksRemaining > 0
                        ? `Next trick — ${alternativeTricksRemaining} left`
                        : "No more next tricks this round"
                    }
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
                  >
                    <RotateCcw size={14} aria-hidden />
                    {busy
                      ? "Finding…"
                      : alternativeTricksRemaining > 0
                        ? `Next · ${alternativeTricksRemaining}`
                        : "No more"}
                  </button>
                </div>
              </div>
            </section>

            {/* action or waiting feedback — same drawer, header X is the only close */}
            {isWaitingForOthers ? (
              <section
                aria-labelledby="trick-waiting-title"
                className="rounded-[14px] border border-outline-variant bg-surface-container-low p-3.5 sm:p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-permission-pending/15 text-permission-pending">
                    <Clock3 size={14} aria-hidden />
                  </span>
                  <h3
                    id="trick-waiting-title"
                    className="font-display text-sm font-bold uppercase tracking-[0.05em] text-on-surface"
                  >
                    Waiting for other riders
                  </h3>
                  <span
                    className="ml-auto h-1.5 w-1.5 -dot rounded-full bg-permission-pending"
                    aria-hidden
                  />
                </div>
                <p className="mt-2 text-[13px] leading-5 text-on-surface-variant">
                  {pendingCount > 0
                    ? `${pendingCount} rider${pendingCount === 1 ? "" : "s"} still to perform — ${pendingNames.join(", ")}${pendingCount > pendingNames.length ? "…" : ""}.`
                    : "Everyone is performing — hang tight for results."}
                </p>
                {current?.attempts && current.attempts.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {current.attempts.map((a) => {
                      const player = game?.players.find(
                        (candidate) => candidate.id === a.playerId,
                      );
                      return (
                        <span
                          key={a.playerId}
                          className={`rounded-[8px] border px-2 py-1 font-display text-[11px] font-bold uppercase tracking-[0.05em] ${a.result === "landed" ? "border-on-surface bg-on-surface text-surface" : "border-outline-variant bg-surface-container-high"}`}
                        >
                          {player?.displayName ?? "Rider"} · {a.result}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : resultAction ? (
              <section
                aria-labelledby="trick-action-title"
                className="rounded-[14px] border border-outline-variant bg-surface-container-lowest p-3.5 sm:p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    id="trick-action-title"
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-secondary"
                  >
                    {resultAction.label}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-secondary">
                    Choose one
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resultAction.onSelect("landed")}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary shadow-[0_1px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary/90 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
                    aria-label="Mark as landed"
                  >
                    <Check size={16} aria-hidden />
                    Landed
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resultAction.onSelect("failed")}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface hover:bg-surface-container-highest disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
                    aria-label="Mark as failed"
                  >
                    <X size={16} aria-hidden />
                    Failed
                  </button>
                </div>
              </section>
            ) : (
              <div className="rounded-[12px] border border-dashed border-outline-variant bg-surface-container-low px-4 py-5 text-center">
                <p className="font-display text-[13px] font-semibold text-on-surface-variant">
                  No action needed — watching the feed.
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-secondary">
                  Close via header ×
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}
