import type { ReactNode } from "react";
import { ProfileGamesListSkeleton } from "../games/ProfileGamesList";
import { ProfileTricksSkeleton } from "../tricks/ProfileTricksPanel";
import { CARD } from "@/components/ui/recipes";

function PreviewCardSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <div className="h-7 w-36 rounded bg-surface-container-high" />
        <div className="h-control-sm w-24 rounded-control bg-surface-container-high" />
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Mirrors the Overview tab: League card, then recent games and tricks. */
export function ProfileOverviewSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className={CARD}>
        <div className="flex items-center justify-between gap-2">
          <div className="h-7 w-24 rounded bg-surface-container-high" />
          <div className="h-control w-28 rounded-control bg-surface-container-high" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-[68px] rounded-card bg-surface-container-high" />
          <div className="h-[68px] rounded-card bg-surface-container-high" />
        </div>
        <div className="mt-3 h-5 w-64 max-w-full rounded bg-surface-container-high" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <PreviewCardSkeleton>
          <ProfileGamesListSkeleton count={3} />
        </PreviewCardSkeleton>
        <PreviewCardSkeleton>
          <ProfileTricksSkeleton variant="summary" />
        </PreviewCardSkeleton>
      </div>
    </div>
  );
}
