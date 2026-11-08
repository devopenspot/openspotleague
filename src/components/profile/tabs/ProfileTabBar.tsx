"use client";

import { useRef, type KeyboardEvent, type Ref } from "react";
import { PROFILE_TABS, type TabId } from "./profile-tabs";
import { SEGMENTED_TRACK, segmentClass } from "@/components/ui/recipes";

interface ProfileTabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
  ref?: Ref<HTMLDivElement>;
}

/**
 * ARIA tabs: one tab stop (roving tabIndex); ArrowLeft/ArrowRight wrap,
 * Home/End jump, and moving focus also activates the tab.
 */
export function ProfileTabBar({ active, onChange, ref }: ProfileTabBarProps) {
  const buttons = useRef<Map<TabId, HTMLButtonElement>>(new Map());

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = PROFILE_TABS.findIndex((t) => t.id === active);
    const last = PROFILE_TABS.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? last : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = last;
    const next = nextIndex === null ? undefined : PROFILE_TABS[nextIndex];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    buttons.current.get(next.id)?.focus();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Profile sections"
      onKeyDown={handleKeyDown}
      className={`scroll-mt-4 ${SEGMENTED_TRACK}`}
    >
      {PROFILE_TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            ref={(node) => {
              if (node) buttons.current.set(t.id, node);
              else buttons.current.delete(t.id);
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${t.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={segmentClass(isActive)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileTabBarSkeleton() {
  return (
    <div aria-hidden="true" className={SEGMENTED_TRACK}>
      {PROFILE_TABS.map((t) => (
        <div key={t.id} className="h-control-sm grow rounded-control bg-surface-container-high" />
      ))}
    </div>
  );
}
