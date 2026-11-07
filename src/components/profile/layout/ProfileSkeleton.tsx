import { ProfileHeroSkeleton } from "./ProfileHero";
import { ProfileStatsSkeleton } from "./ProfileStats";
import { ProfileOverviewSkeleton } from "./ProfileOverviewSkeleton";
import { ProfileShell } from "./ProfileShell";
import { ProfileTabBarSkeleton } from "../tabs/ProfileTabBar";
import { RiderActivityBoardSkeleton } from "@/components/games/board/RiderActivityBoard";
import { EYEBROW } from "@/components/ui/recipes";

/** Single loading mirror for /profile — used by loading.tsx and ProfileClient. */
export function ProfileSkeleton() {
  return (
    <ProfileShell role="status" aria-busy="true" aria-label="Loading profile">
      <p className={EYEBROW}>Your profile</p>
      <div
        className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-5"
        aria-hidden="true"
      >
        <div className="space-y-4">
          <ProfileHeroSkeleton />
          <ProfileStatsSkeleton />
        </div>
        <RiderActivityBoardSkeleton />
      </div>
      <div className="mt-6 pb-18" aria-hidden="true">
        <ProfileTabBarSkeleton />
        <div className="mt-5 min-h-[360px] sm:min-h-[420px]">
          <ProfileOverviewSkeleton />
        </div>
      </div>
    </ProfileShell>
  );
}
