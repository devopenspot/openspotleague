"use client";

import { useCallback, useRef, useState } from "react";
import { profileTabSearch, type TabId } from "@/components/profile/tabs/profile-tabs";

export type { TabId };

/**
 * Active profile tab, mirrored to `?tab=` with replaceState so a refresh,
 * a shared link or coming back to the page lands on the same tab without
 * adding a history entry per tap.
 */
export function useProfileTab(initial: TabId) {
  const [tab, setTabState] = useState<TabId>(initial);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const selectTab = useCallback((next: TabId, opts?: { scroll?: boolean }) => {
    setTabState(next);
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}${profileTabSearch(next)}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
    }
    if (opts?.scroll) {
      // The tab bar is always mounted, unlike the panel that is about to render.
      requestAnimationFrame(() => {
        tabBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  return { tab, selectTab, tabBarRef };
}
