"use client";

import type { ReactNode } from "react";
import { ProfileHero } from "./layout/ProfileHero";
import { ProfileStats } from "./layout/ProfileStats";
import { ProfileShell } from "./layout/ProfileShell";
import { ProfileLeagueCard } from "./league/ProfileLeagueCard";
import { ProfileGamesList } from "./games/ProfileGamesList";
import { ProfileSpotsGrid } from "./spots/ProfileSpotsGrid";
import { ProfileTricksPanel } from "./tricks/ProfileTricksPanel";
import { ProfileAccount } from "./settings/ProfileAccount";
import { ProfileTabBar } from "./tabs/ProfileTabBar";
import type { TabId } from "./tabs/profile-tabs";
import { useProfileTab } from "./hooks/useProfileTab";
import { useProfileTricks } from "./hooks/useProfileTricks";
import { CARD, CARD_TITLE, EYEBROW_ON_WASH, controlClass } from "@/components/ui/recipes";
import { RiderActivityBoard } from "@/components/games/board/RiderActivityBoard";
import type { ProfileSummary } from "@/lib/services/profile/profile";

function TabPanel({ id, className = "", children }: { id: TabId; className?: string; children: ReactNode }) {
  return (
    <div id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

function PreviewCard({
  title,
  titleId,
  action,
  onAction,
  children,
}: {
  title: string;
  titleId: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className={CARD} aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className={CARD_TITLE}>
          {title}
        </h2>
        <button type="button" onClick={onAction} className={controlClass("outline", "sm")}>
          {action}
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ProfileClient({ summary, initialTab }: { summary: ProfileSummary; initialTab: TabId }) {
  const { tab, selectTab, tabBarRef } = useProfileTab(initialTab);
  const tricks = useProfileTricks();
  const jumpTo = (next: TabId) => selectTab(next, { scroll: true });

  return (
    <ProfileShell>
      <p className={EYEBROW_ON_WASH}>Your profile</p>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-3">
          <ProfileHero summary={summary} />
          <ProfileStats summary={summary} onSelectTab={jumpTo} />
        </div>
        <RiderActivityBoard data={{ days: summary.activity, error: false }} headingId="profile-activity-title" />
      </div>

      <div className="mt-6 pb-18">
        <ProfileTabBar ref={tabBarRef} active={tab} onChange={(next) => selectTab(next)} />

        <div className="mt-5 min-h-[360px] sm:min-h-[420px]">
          {tab === "overview" ? (
            <TabPanel id="overview" className="space-y-4">
              <ProfileLeagueCard summary={summary} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <PreviewCard title="Recent games" titleId="profile-recent-games" action="View all" onAction={() => jumpTo("games")}>
                  <ProfileGamesList variant="preview" />
                </PreviewCard>
                <PreviewCard title="Tricks" titleId="profile-tricks-summary" action="Details" onAction={() => jumpTo("tricks")}>
                  <ProfileTricksPanel state={tricks} variant="summary" />
                </PreviewCard>
              </div>
            </TabPanel>
          ) : null}

          {tab === "games" ? (
            <TabPanel id="games">
              <ProfileGamesList />
            </TabPanel>
          ) : null}

          {tab === "spots" ? (
            <TabPanel id="spots">
              <ProfileSpotsGrid counts={summary.counts} />
            </TabPanel>
          ) : null}

          {tab === "tricks" ? (
            <TabPanel id="tricks">
              <ProfileTricksPanel state={tricks} />
            </TabPanel>
          ) : null}

          {tab === "account" ? (
            <TabPanel id="account">
              <ProfileAccount user={summary.user} />
            </TabPanel>
          ) : null}
        </div>
      </div>
    </ProfileShell>
  );
}
