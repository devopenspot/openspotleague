"use client";

import { useState } from "react";

export type TabId = "overview" | "play" | "spots" | "tricks" | "settings";

export function useProfileTab(initial: TabId = "overview") {
  const [tab, setTab] = useState<TabId>(initial);

  const handleSelectTab = (next: string) => {
    if (
      next === "play" ||
      next === "spots" ||
      next === "tricks" ||
      next === "settings" ||
      next === "overview"
    ) {
      setTab(next as TabId);
      document
        .getElementById(`panel-${next}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return { tab, setTab, handleSelectTab };
}
