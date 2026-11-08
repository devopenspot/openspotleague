/**
 * Profile tab model. Plain module (no "use client") so the server page can
 * parse `?tab=` and the client hook and tab bar share one list.
 */
export const PROFILE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "games", label: "Games" },
  { id: "spots", label: "Spots" },
  { id: "tricks", label: "Tricks" },
  { id: "account", label: "Account" },
] as const;

export type TabId = (typeof PROFILE_TABS)[number]["id"];

export const DEFAULT_PROFILE_TAB: TabId = "overview";

/** Old tab ids that may still live in bookmarks or links. */
const LEGACY_TABS: Readonly<Record<string, TabId>> = {
  play: "games",
  settings: "account",
};

export function parseProfileTab(value: unknown): TabId {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return DEFAULT_PROFILE_TAB;
  const id = raw.trim().toLowerCase();
  const match = PROFILE_TABS.find((tab) => tab.id === id);
  return match?.id ?? LEGACY_TABS[id] ?? DEFAULT_PROFILE_TAB;
}

/** `/profile` for the default tab, `/profile?tab=<id>` otherwise. */
export function profileTabSearch(tab: TabId): string {
  return tab === DEFAULT_PROFILE_TAB ? "" : `?tab=${tab}`;
}
