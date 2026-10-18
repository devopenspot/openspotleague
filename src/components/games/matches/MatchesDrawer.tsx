"use client";

import { X } from "lucide-react";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { MatchList } from "@/components/games/matches/MatchList";

const DRAWER_TITLE_ID = "matches-drawer-title";

export function MatchesDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={DRAWER_TITLE_ID}
      testId="matches-drawer"
      panelClassName="w-[min(36rem,calc(100vw-2rem))]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-outline p-6">
        <div>
           <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Your matches
          </p>
          <h2
            id={DRAWER_TITLE_ID}
            className="mt-2 font-display text-4xl font-bold uppercase leading-none"
          >
            Active & recent
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close matches"
           className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline text-on-surface transition-colors hover:border-primary hover:bg-surface-container"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <MatchList bare limit={100} />
      </div>
    </SideDrawer>
  );
}
