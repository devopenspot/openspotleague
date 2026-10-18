import { ProfileHeroSkeleton } from "@/components/profile/layout/ProfileHero";
import { ProfileStatsSkeleton } from "@/components/profile/layout/ProfileStats";
import { RiderActivityBoardSkeleton } from "@/components/games/board/RiderActivityBoard";
import { ProfileTabBarSkeleton } from "@/components/profile/tabs/ProfileTabBar";
import { ProfileOverviewSkeleton } from "@/components/profile/layout/ProfileOverviewSkeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      aria-busy="true"
      className="min-h-dvh bg-gradient-to-r from-lime-100 via-lime-200 to-lime-400"
    >
      <div className="mx-auto max-w-5xl px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
          Your profile
        </p>

        {/* Main grid — mirrors ProfileClient lg:grid-cols-[1.15fr_0.85fr] */}
        <div
          className="mt-3 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-5"
          aria-hidden="true"
        >
          <div className="space-y-4">
            <ProfileHeroSkeleton />
            <ProfileStatsSkeleton />
          </div>

          <div className="overflow-hidden rounded-[16px] border border-outline-variant">
            <RiderActivityBoardSkeleton />
          </div>
        </div>

        {/* Tab bar + initial overview tab content */}
        <div className="mt-6 pb-18" aria-hidden="true">
          <ProfileTabBarSkeleton />
          <div className="mt-5 min-h-[360px] sm:min-h-[420px]">
            <ProfileOverviewSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
