"use client";

import type { TabId } from "@/components/profile/hooks/useProfileTab";
import { SEGMENTED_TRACK, segmentClass } from "@/components/ui/recipes";

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
      className={SEGMENTED_TRACK}
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
            className={segmentClass(isActive)}
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
      className={SEGMENTED_TRACK}
    >
      {TABS.map((t) => (
        <div
          key={t.id}
          className="h-control-sm grow rounded-control bg-surface-container-high"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
