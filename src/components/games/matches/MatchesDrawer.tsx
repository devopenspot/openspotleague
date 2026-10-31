"use client";

import { DrawerHeader, SIDE_DRAWER_PANEL } from "@/components/feedback/DrawerParts";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { MatchList } from "@/components/games/matches/MatchList";
import type { ReactNode } from "react";

const DRAWER_TITLE_ID = "matches-drawer-title";

export function MatchesDrawer({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Rendered above the list. */
  children?: ReactNode;
}) {
  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={DRAWER_TITLE_ID}
      contentId="matches-drawer"
      testId="matches-drawer"
      panelClassName={SIDE_DRAWER_PANEL}
    >
      <DrawerHeader
        eyebrow="Your games"
        title="Active & recent"
        titleId={DRAWER_TITLE_ID}
        closeLabel="Close matches"
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {children}
        <MatchList bare limit={100} />
      </div>
    </SideDrawer>
  );
}
