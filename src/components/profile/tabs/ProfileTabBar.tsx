"use client";

import type { TabId } from "@/components/profile/hooks/useProfileTab";

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
      className="flex gap-1 overflow-x-auto no-scrollbar scroll-p-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1"
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
            className={`min-h-8 shrink-0 rounded-full px-3 font-display text-[11px] font-bold uppercase tracking-[0.06em] transition-colors sm:px-3.5 ${isActive ? "bg-primary text-on-primary" : "text-secondary hover:bg-surface-container hover:text-on-surface"}`}
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
      className="flex gap-1 overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest p-1 animate-pulse"
    >
      {TABS.map((t) => (
        <div
          key={t.id}
          className="h-8 shrink-0 rounded-full bg-surface-container-high px-6 sm:px-8 "
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
