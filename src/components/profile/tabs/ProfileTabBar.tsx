"use client";

import type { TabId } from "@/components/profile/hooks/useProfileTab";
import { profileSegmentClass } from "@/components/profile/profile-styles";

const TABS: readonly { id: TabId; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "Home" },
  { id: "play", label: "Play", short: "Play" },
  { id: "spots", label: "Spots", short: "Spots" },
  { id: "tricks", label: "Tricks", short: "Tricks" },
  { id: "settings", label: "Settings", short: "You" },
];

interface ProfileTabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function ProfileTabBar({ active, onChange }: ProfileTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="flex overflow-x-auto no-scrollbar rounded-lg border-2 border-outline-variant bg-surface-container-lowest"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`${profileSegmentClass(isActive)} grow`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ProfileTabBarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex overflow-hidden rounded-lg border-2 border-outline-variant bg-surface-container-lowest"
    >
      {TABS.map((t) => (
        <div
          key={t.id}
          className="h-11 grow border-l border-outline-variant bg-surface-container-high first:border-l-0"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
