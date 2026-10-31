"use client";

import { useState } from "react";
import {
  DrawerFooter,
  DrawerHeader,
  SIDE_DRAWER_PANEL,
} from "@/components/feedback/DrawerParts";
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

  function closeUnlessBusy() {
    if (!busy) onClose();
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={closeUnlessBusy}
      labelledBy={SETTINGS_TITLE_ID}
      testId="challenge-settings-drawer"
      contentId="challenge-settings-drawer"
      panelClassName={SIDE_DRAWER_PANEL}
    >
      <DrawerHeader
        eyebrow={liveChallenge ? "Change Line" : "Leader Picks"}
        title={liveChallenge ? "Next Trick" : "Set The Line"}
        titleId={SETTINGS_TITLE_ID}
        closeLabel="Close Trick Settings"
        onClose={closeUnlessBusy}
        closeDisabled={busy}
      />

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ spotType, level });
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <p className="text-sm leading-6 text-on-surface-variant">
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

        <DrawerFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-12 flex-1 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-colors hover:bg-surface-container disabled:cursor-wait disabled:border-outline"
          >
            Not Now
          </button>
          <button
            type="submit"
            disabled={busy || !spotType}
            className="min-h-12 flex-1 rounded-lg border-2 border-primary bg-primary px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:border-outline disabled:bg-surface-container-high disabled:text-on-surface"
          >
            {busy ? "Locking It In…" : "Lock It In"}
          </button>
        </DrawerFooter>
      </form>
    </SideDrawer>
  );
}
