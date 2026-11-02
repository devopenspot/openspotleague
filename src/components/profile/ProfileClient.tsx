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
  PROFILE_BODY_CLASS,
  PROFILE_BUTTON_CLASS,
  PROFILE_CARD_TITLE_CLASS,
  PROFILE_EYEBROW_CLASS,
} from "./profile-styles";
import {
  RiderActivityBoard,
  RiderActivityBoardSkeleton,
} from "@/components/games/board/RiderActivityBoard";
import type { RiderActivityDay } from "@/lib/services/profile/ranking";
import { SignOutButton } from "@/components/shell/SignOutButton";

const GLANCE_TILE_CLASS =
  "rounded-[12px] border border-outline-variant bg-surface-container px-3 py-3";
const GLANCE_VALUE_CLASS = "mt-1 font-display text-base font-bold leading-none";
const CARD_CLASS =
  "rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4";

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
          <p className={PROFILE_EYEBROW_CLASS}>Your profile</p>
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
        <p className={PROFILE_CARD_TITLE_CLASS}>Couldn’t load profile</p>
        <p className={`mt-1.5 ${PROFILE_BODY_CLASS}`}>
          Check your connection and try again
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className={`mt-5 ${PROFILE_BUTTON_CLASS}`}
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
          <p className={PROFILE_EYEBROW_CLASS}>Your profile</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-4">
            <ProfileHero summary={summary} />
            <ProfileStats summary={summary} onSelectTab={handleSelectTab} />
          </div>

          <div className="min-w-0 overflow-hidden rounded-[16px] border border-outline-variant">
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
                <section className={CARD_CLASS}>
                  <h3 className={PROFILE_CARD_TITLE_CLASS}>At a glance</h3>
                  <p className={`mt-1 ${PROFILE_BODY_CLASS}`}>
                    Tap a stat to dive in — built for quick checks between
                    sessions
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className={GLANCE_TILE_CLASS}>
                      <p className={PROFILE_EYEBROW_CLASS}>Next rank</p>
                      <p className={GLANCE_VALUE_CLASS}>
                        {summary.nextRank ? summary.nextRank.label : "Maxed"}
                      </p>
                      <p className={`mt-1 ${PROFILE_EYEBROW_CLASS}`}>
                        {summary.nextRank
                          ? `${summary.nextRank.pointsNeeded} pts to go`
                          : "Stay on top"}
                      </p>
                    </div>
                    <div className={GLANCE_TILE_CLASS}>
                      <p className={PROFILE_EYEBROW_CLASS}>Streak</p>
                      <p className={GLANCE_VALUE_CLASS}>
                        {summary.streakDays} days
                      </p>
                      <p className={`mt-1 ${PROFILE_EYEBROW_CLASS}`}>
                        {summary.streakDays >= 2
                          ? "Keep it 🔥"
                          : "Play today to start"}
                      </p>
                    </div>
                    <div className={GLANCE_TILE_CLASS}>
                      <p className={PROFILE_EYEBROW_CLASS}>Units</p>
                      <p className={`${GLANCE_VALUE_CLASS} uppercase`}>
                        {summary.preferences.distanceUnit} • °
                        {summary.preferences.temperatureUnit}
                      </p>
                      <p className={`mt-1 ${PROFILE_EYEBROW_CLASS}`}>
                        {summary.preferences.disciplineSlug ??
                          "No sport picked"}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={PROFILE_CARD_TITLE_CLASS}>Recent play</h4>
                      <button
                        type="button"
                        onClick={() => setTab("play")}
                        className={PROFILE_BUTTON_CLASS}
                      >
                        View all
                      </button>
                    </div>
                    <div className="mt-3">
                      <ProfileGamesList />
                    </div>
                  </div>
                  <div className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={PROFILE_CARD_TITLE_CLASS}>Tricks</h4>
                      <button
                        type="button"
                        onClick={() => setTab("tricks")}
                        className={PROFILE_BUTTON_CLASS}
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
                <div className={CARD_CLASS}>
                  <h3
                    className={`flex items-center gap-2 ${PROFILE_CARD_TITLE_CLASS}`}
                  >
                    <Settings size={18} /> Account
                  </h3>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold">
                        {summary.user.name || summary.user.email}
                      </p>
                      <p className={`truncate ${PROFILE_BODY_CLASS}`}>
                        {summary.user.email}
                      </p>
                    </div>
                    <SignOutButton className="!h-12 !w-full !rounded-lg !border-2 !border-outline-variant !bg-surface-container-high hover:!bg-surface-container-highest active:translate-y-px sm:!w-12" />
                  </div>
                  <p
                    className={`mt-3 flex items-center gap-1.5 ${PROFILE_BODY_CLASS}`}
                  >
                    <LogOut size={14} /> Sign out on this device
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
