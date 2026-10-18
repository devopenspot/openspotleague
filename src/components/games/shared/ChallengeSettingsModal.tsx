"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import type { TrickLevel } from "@/lib/schemas/game";
import { ChallengeSettingsFields } from "@/components/games/shared/ChallengeSettingsFields";

const SETTINGS_TITLE_ID = "challenge-settings-title";

export function ChallengeSettingsModal({
  isOpen,
  onClose,
  spotTypes,
  initialSpotType,
  initialLevel,
  selectedCategories,
  liveChallenge,
  busy,
  onSubmit,
  disciplineSlug,
  pendingProposal,
  players,
  viewerPlayerId,
  onCategoriesPropose,
  onCategoriesVote,
}: {
  isOpen: boolean;
  onClose: () => void;
  spotTypes: readonly { slug: string; name: string; sortOrder: number }[];
  initialSpotType: string;
  initialLevel: TrickLevel | null;
  selectedCategories?: readonly string[] | null;
  liveChallenge: boolean;
  busy: boolean;
  onSubmit: (settings: {
    spotType: string;
    level: TrickLevel;
  }) => Promise<void>;
  disciplineSlug?: string;
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
  const [spotType, setSpotType] = useState(initialSpotType);
  const [level, setLevel] = useState<TrickLevel>(initialLevel ?? 1);

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={SETTINGS_TITLE_ID}
      testId="challenge-settings-drawer"
      contentId="challenge-settings-drawer"
      panelClassName="w-[min(34rem,calc(100vw-1rem))] rounded-l-[16px] border-l border-outline-variant sm:w-[min(34rem,calc(100vw-2rem))] max-h-[100dvh] sm:max-h-[min(90dvh,48rem)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-outline-variant p-4 sm:gap-4 sm:p-6">
        <div className="min-w-0">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary sm:text-xs">
            {liveChallenge ? "Switch It Up" : "Leader Picks"}
          </p>
          <h2
            id={SETTINGS_TITLE_ID}
            className="mt-1.5 font-display text-2xl font-bold leading-none sm:mt-2 sm:text-[32px] sm:leading-[1.3]"
          >
            {liveChallenge ? "Next Trick" : "Set The Line"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close Trick Settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-outline-variant text-on-surface transition-colors hover:border-primary hover:bg-surface-container disabled:opacity-50 sm:h-11 sm:w-11 sm:rounded-[16px]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ spotType, level });
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <p className="max-w-md text-xs leading-5 text-on-surface-variant sm:text-sm sm:leading-6">
            Pick Where and How Hard — We’ll Pull a Trick That Fits Immediately
            in Flexible Mode.
          </p>

          <ChallengeSettingsFields
            spotTypes={spotTypes}
            spotType={spotType}
            level={level}
            busy={busy}
            onSpotTypeChange={setSpotType}
            onLevelChange={setLevel}
            disciplineSlug={disciplineSlug}
            nextSpotType={spotType}
            nextLevel={level}
            selectedCategories={selectedCategories}
            pendingProposal={pendingProposal}
            players={players}
            viewerPlayerId={viewerPlayerId}
            onCategoriesPropose={onCategoriesPropose}
            onCategoriesVote={onCategoriesVote}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-10 rounded-full border border-outline-variant bg-surface px-4 font-display text-[11px] font-bold uppercase tracking-[0.05em] transition-colors hover:bg-surface-container sm:min-h-12 sm:px-5 sm:text-xs disabled:opacity-50"
          >
            Not Now
          </button>
          <button
            type="submit"
            disabled={busy || !spotType}
            className="min-h-10 rounded-full bg-primary px-4 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-on-primary transition-colors hover:bg-primary/90 sm:min-h-12 sm:px-5 sm:text-xs disabled:cursor-wait disabled:opacity-50"
          >
            {busy ? "Locking It In…" : "Lock It In"}
          </button>
        </div>
      </form>
    </SideDrawer>
  );
}
