"use client";

import { Settings, LogOut } from "lucide-react";
import { ProfileHero, ProfileHeroSkeleton } from "./layout/ProfileHero";
import { ProfileStats, ProfileStatsSkeleton } from "./layout/ProfileStats";
import { ProfileGamesList } from "./games/ProfileGamesList";
import { ProfileSpotsGrid } from "./spots/ProfileSpotsGrid";
import { ProfileTricksPanel } from "./settings/ProfileTricksPanel";
import { ProfileSettings } from "./settings/ProfileSettings";
import { ProfileTabBar, ProfileTabBarSkeleton } from "./tabs/ProfileTabBar";
import { ProfileOverviewSkeleton } from "./layout/ProfileOverviewSkeleton";
import { useProfileTab } from "./hooks/useProfileTab";
import { useProfileSummary } from "./hooks/useProfileSummary";
import {
  RiderActivityBoard,
  RiderActivityBoardSkeleton,
} from "@/components/games/board/RiderActivityBoard";
import type { RiderActivityDay } from "@/lib/services/profile/ranking";
import { SignOutButton } from "@/components/shell/SignOutButton";

export function ProfileClient() {
  const { summary, loading, error } = useProfileSummary();
  const { tab, setTab, handleSelectTab } = useProfileTab("overview");

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading profile"
        className="min-h-dvh bg-gradient-to-r from-lime-100 via-lime-200 to-lime-400"
      >
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            Your profile
          </p>
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

  if (error || !summary) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center sm:px-6">
        <p className="font-display text-base font-bold uppercase">
          Couldn’t load profile
        </p>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-secondary">
          Check your connection and try again
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-5 min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-[11px] font-bold uppercase tracking-widest"
        >
          Retry
        </button>
      </div>
    );
  }

  const activityData = {
    days: summary.activity as readonly RiderActivityDay[],
    error: false,
  };

  return (
    <div className="bg-gradient-to-r from-lime-100 via-lime-200 to-lime-400">
      <div className="mx-auto max-w-5xl px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex items-center justify-between">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            Your profile
          </p>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-5">
          <div className="space-y-4">
            <ProfileHero summary={summary} />
            <ProfileStats summary={summary} onSelectTab={handleSelectTab} />
          </div>

          <div className="overflow-hidden rounded-[16px] border border-outline-variant">
            <RiderActivityBoard
              data={activityData}
              headingId="profile-activity-title"
            />
          </div>
        </div>

        <div className="mt-6 pb-18">
          <ProfileTabBar active={tab} onChange={setTab} />

          <div className="mt-5 min-h-[360px] sm:min-h-[420px]">
            {tab === "overview" ? (
              <div
                id="panel-overview"
                role="tabpanel"
                aria-labelledby="tab-overview"
                className="space-y-4 animate-fade-in"
              >
                <section className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                  <h3 className="font-display text-[13px] font-bold uppercase tracking-tight">
                    At a glance
                  </h3>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
                    Tap a stat to dive in — built for quick checks between
                    sessions
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[12px] border border-outline-variant bg-surface-container px-2.5 py-2.5">
                      <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-secondary">
                        Next rank
                      </p>
                      <p className="mt-1 font-display text-[13px] font-bold leading-none">
                        {summary.nextRank ? summary.nextRank.label : "Maxed"}
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
                        {summary.nextRank
                          ? `${summary.nextRank.pointsNeeded} pts to go`
                          : "Stay on top"}
                      </p>
                    </div>
                    <div className="rounded-[12px] border border-outline-variant bg-surface-container px-2.5 py-2.5">
                      <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-secondary">
                        Streak
                      </p>
                      <p className="mt-1 font-display text-[13px] font-bold leading-none">
                        {summary.streakDays} days
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
                        {summary.streakDays >= 2
                          ? "Keep it 🔥"
                          : "Play today to start"}
                      </p>
                    </div>
                    <div className="rounded-[12px] border border-outline-variant bg-surface-container px-2.5 py-2.5">
                      <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-secondary">
                        Units
                      </p>
                      <p className="mt-1 font-display text-[13px] font-bold uppercase leading-none">
                        {summary.preferences.distanceUnit} • °
                        {summary.preferences.temperatureUnit}
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-secondary">
                        {summary.preferences.disciplineSlug ??
                          "No sport picked"}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-[12px] font-bold uppercase tracking-wide">
                        Recent play
                      </h4>
                      <button
                        type="button"
                        onClick={() => setTab("play")}
                        className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className="mt-3">
                      <ProfileGamesList />
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-[12px] font-bold uppercase tracking-wide">
                        Tricks
                      </h4>
                      <button
                        type="button"
                        onClick={() => setTab("tricks")}
                        className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        Details
                      </button>
                    </div>
                    <div className="mt-3">
                      <ProfileTricksPanel />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "play" ? (
              <div
                id="panel-play"
                role="tabpanel"
                aria-labelledby="tab-play"
                className="animate-fade-in"
              >
                <ProfileGamesList />
              </div>
            ) : null}

            {tab === "spots" ? (
              <div
                id="panel-spots"
                role="tabpanel"
                aria-labelledby="tab-spots"
                className="animate-fade-in"
              >
                <ProfileSpotsGrid />
              </div>
            ) : null}

            {tab === "tricks" ? (
              <div
                id="panel-tricks"
                role="tabpanel"
                aria-labelledby="tab-tricks"
                className="animate-fade-in"
              >
                <ProfileTricksPanel />
              </div>
            ) : null}

            {tab === "settings" ? (
              <div
                id="panel-settings"
                role="tabpanel"
                aria-labelledby="tab-settings"
                className="space-y-4 animate-fade-in"
              >
                <ProfileSettings />
                <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                  <h3 className="flex items-center gap-2 font-display text-[13px] font-bold uppercase">
                    <Settings size={14} /> Account
                  </h3>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-display text-[13px] font-semibold">
                        {summary.user.name || summary.user.email}
                      </p>
                      <p className="truncate font-mono text-[11px] uppercase tracking-widest text-secondary">
                        {summary.user.email}
                      </p>
                    </div>
                    <SignOutButton className="w-full sm:w-auto rounded-full border border-outline-variant bg-surface-container-high px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest hover:bg-surface-container-highest" />
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-secondary">
                    <LogOut size={12} /> Sign out on this device
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
