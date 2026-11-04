"use client";

import { Settings, LogOut } from "lucide-react";
import { ProfileHero } from "./layout/ProfileHero";
import { ProfileStats } from "./layout/ProfileStats";
import { ProfileGamesList } from "./games/ProfileGamesList";
import { ProfileSpotsGrid } from "./spots/ProfileSpotsGrid";
import { ProfileTricksPanel } from "./settings/ProfileTricksPanel";
import { ProfileSettings } from "./settings/ProfileSettings";
import { ProfileTabBar } from "./tabs/ProfileTabBar";
import { ProfileShell } from "./layout/ProfileShell";
import { ProfileSkeleton } from "./layout/ProfileSkeleton";
import { useProfileTab } from "./hooks/useProfileTab";
import { useProfileSummary } from "./hooks/useProfileSummary";
import { BODY, CARD, CARD_TITLE, EYEBROW, META, TILE, controlClass } from "@/components/ui/recipes";
import { RiderActivityBoard } from "@/components/games/board/RiderActivityBoard";
import type { RiderActivityDay } from "@/lib/services/profile/ranking";
import { SignOutButton } from "@/components/shell/SignOutButton";

const GLANCE_TILE_CLASS = TILE;
const GLANCE_VALUE_CLASS = "mt-1 font-display text-base font-bold leading-none";
const CARD_CLASS = CARD;

export function ProfileClient() {
  const { summary, loading, error } = useProfileSummary();
  const { tab, setTab, handleSelectTab } = useProfileTab("overview");

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !summary) {
    return (
      <ProfileShell>
        <div className={`${CARD_CLASS} mx-auto my-6 max-w-md text-center sm:p-8`}>
        <h1 className={`${CARD_TITLE} text-on-surface`}>Couldn’t load profile</h1>
        <p className={`mt-1.5 ${BODY}`}>
          Check your connection and try again
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className={`mt-5 ${controlClass("outline")}`}
        >
          Retry
        </button>
        </div>
      </ProfileShell>
    );
  }

  const activityData = {
    days: summary.activity as readonly RiderActivityDay[],
    error: false,
  };

  return (
    <ProfileShell>
        <div className="flex items-center justify-between">
          <p className={EYEBROW}>Your profile</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-4">
            <ProfileHero summary={summary} />
            <ProfileStats summary={summary} onSelectTab={handleSelectTab} />
          </div>

          <div className="min-w-0 overflow-hidden rounded-container border border-outline-variant">
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
                  <h2 className={CARD_TITLE}>At a glance</h2>
                  <p className={`mt-1 ${BODY}`}>
                    Tap a stat to dive in — built for quick checks between
                    sessions
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className={GLANCE_TILE_CLASS}>
                      <p className={META}>Next rank</p>
                      <p className={GLANCE_VALUE_CLASS}>
                        {summary.nextRank ? summary.nextRank.label : "Maxed"}
                      </p>
                      <p className={`mt-1 ${META}`}>
                        {summary.nextRank
                          ? `${summary.nextRank.pointsNeeded} pts to go`
                          : "Stay on top"}
                      </p>
                    </div>
                    <div className={GLANCE_TILE_CLASS}>
                      <p className={META}>Streak</p>
                      <p className={GLANCE_VALUE_CLASS}>
                        {summary.streakDays} days
                      </p>
                      <p className={`mt-1 ${META}`}>
                        {summary.streakDays >= 2
                          ? "Keep it 🔥"
                          : "Play today to start"}
                      </p>
                    </div>
                    <div className={GLANCE_TILE_CLASS}>
                      <p className={META}>Units</p>
                      <p className={`${GLANCE_VALUE_CLASS} uppercase`}>
                        {summary.preferences.distanceUnit} • °
                        {summary.preferences.temperatureUnit}
                      </p>
                      <p className={`mt-1 ${META}`}>
                        {summary.preferences.disciplineSlug ??
                          "No sport picked"}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={CARD_TITLE}>Recent play</h2>
                      <button
                        type="button"
                        onClick={() => setTab("play")}
                        className={controlClass("outline")}
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
                      <h2 className={CARD_TITLE}>Tricks</h2>
                      <button
                        type="button"
                        onClick={() => setTab("tricks")}
                        className={controlClass("outline")}
                      >
                        Details
                      </button>
                    </div>
                    <div className="mt-3">
                      <ProfileTricksPanel bare />
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
                  <h2
                    className={`flex items-center gap-2 ${CARD_TITLE}`}
                  >
                    <Settings size={18} aria-hidden="true" /> Account
                  </h2>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold">
                        {summary.user.name || summary.user.email}
                      </p>
                      <p className={`truncate ${BODY}`}>
                        {summary.user.email}
                      </p>
                    </div>
                    <SignOutButton variant="profile" />
                  </div>
                  <p
                    className={`mt-3 flex items-center gap-1.5 ${BODY}`}
                  >
                    <LogOut size={14} aria-hidden="true" /> Sign out on this device
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
    </ProfileShell>
  );
}
