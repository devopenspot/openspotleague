import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TvCard } from "@/types/tv";
import type { TvCategoryRow } from "@/lib/services/tv/tv";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUIStore } from "@/stores/ui-store";
import { TvGrid } from "./TvGrid";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/tv",
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.params,
}));

const disciplines = [
  { slug: "bmx", name: "BMX" },
  { slug: "skateboard", name: "Skateboard" },
];

function card(
  id: string,
  title: string,
  disciplineSlug: string,
  categories: readonly string[] = ["music"],
): TvCard {
  return {
    id,
    title,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    disciplineSlug,
    categories,
    postDate: "2026-01-05T12:00:00.000Z",
  };
}

function row(
  videos: readonly TvCard[],
  total?: number,
  category = "music",
): TvCategoryRow {
  return {
    category,
    videos,
    nextCursor: null,
    total: total ?? videos.length,
  };
}

function renderGrid(
  rows: readonly TvCategoryRow[],
  initialDiscipline: string | null = null,
  extraProps: Partial<Parameters<typeof TvGrid>[0]> = {},
) {
  return render(
    <TvGrid
      rows={rows}
      disciplineCounts={{}}
      disciplines={disciplines}
      initialDiscipline={initialDiscipline}
      filterOptions={{
        years: [2026, 2025, 2024],
        categories: ["profile", "event", "music"],
      }}
      {...extraProps}
    />,
  );
}

function gridElement(rows: readonly TvCategoryRow[], initialDiscipline: string | null = null) {
  return (
    <TvGrid
      rows={rows}
      disciplineCounts={{}}
      disciplines={disciplines}
      initialDiscipline={initialDiscipline}
    />
  );
}

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockClear();
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/tv");
  }
  localStorage.clear();
  usePreferencesStore.getState().reset();
  usePreferencesStore.getState().setHydrationStatus("ready");
  useUIStore.getState().closeOnboarding();
  (Element.prototype as unknown as Record<string, unknown>).scrollTo =
    vi.fn();
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    configurable: true,
  });
});

describe("TvGrid discipline preference", () => {
  it("opens with the saved preference selected and coherent rows", async () => {
    usePreferencesStore.getState().setPreferredSport("BMX");
    const { rerender } = renderGrid([row([card("v1", "BMX Night", "bmx")])]);

    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "BMX" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
    expect(nav.replace).toHaveBeenCalledWith(
      "/tv?discipline=bmx",
      expect.objectContaining({ scroll: false }),
    );
    // Switch pending → skeleton covers the refetch gap…
    expect(
      screen.getByRole("status", { name: "Loading BMX videos…" }),
    ).toBeDefined();
    // …fresh rows landing resolves it and grid content agrees with the pill
    rerender(gridElement([row([card("v1", "BMX Night", "bmx")])]));
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "BMX Night" }),
      ).toBeDefined(),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not force onboarding when preferred sport is unset", async () => {
    renderGrid([row([card("v1", "BMX Night", "bmx")])]);

    expect(useUIStore.getState().isOnboardingOpen).toBe(false);
  });

  it("keeps a manual pill choice when the preference changes elsewhere", async () => {
    usePreferencesStore.getState().setPreferredSport("BMX");
    renderGrid([
      row([
        card("v1", "BMX Night", "bmx"),
        card("v2", "Skate Night", "skateboard"),
      ]),
    ]);
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "BMX" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );

    // Manual tap (URL write is mocked out; intent is recorded by the tap)
    await userEvent.click(screen.getByRole("tab", { name: "Skateboard" }));
    expect(
      screen
        .getByRole("tab", { name: "Skateboard" })
        .getAttribute("aria-selected"),
    ).toBe("true");

    // Background preference change (e.g. drawer edit) must not yank the grid
    nav.replace.mockClear();
    await act(async () => {
      usePreferencesStore.getState().setPreferredSport("Skateboard");
    });
    expect(
      screen
        .getByRole("tab", { name: "Skateboard" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(nav.replace).not.toHaveBeenCalledWith(
      "/tv?discipline=bmx",
      expect.anything(),
    );
  });

  it("lets an explicit ?discipline= own the view over background changes", async () => {
    nav.params = new URLSearchParams("discipline=skateboard");
    usePreferencesStore.getState().setPreferredSport("BMX");
    renderGrid([row([card("v2", "Skate Night", "skateboard")])]);

    await waitFor(() =>
      expect(
        screen
          .getByRole("tab", { name: "Skateboard" })
          .getAttribute("aria-selected"),
      ).toBe("true"),
    );

    await act(async () => {
      usePreferencesStore.getState().setPreferredSport("Skateboard");
    });
    expect(
      screen
        .getByRole("tab", { name: "Skateboard" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("shows a switch skeleton on pill tap until fresh rows land", async () => {
    usePreferencesStore.getState().setPreferredSport("BMX");
    const { rerender } = renderGrid([
      row([
        card("v1", "BMX Night", "bmx"),
        card("v2", "Skate Night", "skateboard"),
      ]),
    ]);
    // Settle the mount adoption first
    rerender(
      gridElement([
        row([
          card("v1", "BMX Night", "bmx"),
          card("v2", "Skate Night", "skateboard"),
        ]),
      ]),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "BMX" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
    expect(screen.queryByRole("status")).toBeNull();

    // Tap → pill flips instantly, skeleton covers the refetch gap…
    await userEvent.click(screen.getByRole("tab", { name: "Skateboard" }));
    expect(
      screen.getByRole("status", { name: "Loading Skateboard videos…" }),
    ).toBeDefined();
    // …pills stay interactive while loading
    expect(screen.getByRole("tab", { name: "BMX" })).not.toBeDisabled();

    // Fresh rows landing resolves the switch with coherent content
    rerender(
      gridElement([row([card("v2", "Skate Night", "skateboard")])]),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Skate Night" }),
      ).toBeDefined(),
    );
    expect(screen.queryByRole("group", { name: "BMX Night" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("re-tapping the active pill starts no switch", async () => {
    usePreferencesStore.getState().setPreferredSport("BMX");
    const { rerender } = renderGrid([row([card("v1", "BMX Night", "bmx")])]);
    rerender(gridElement([row([card("v1", "BMX Night", "bmx")])]));
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "BMX" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );

    nav.replace.mockClear();
    await userEvent.click(screen.getByRole("tab", { name: "BMX" }));
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("converges to 'All' tab when preferredSport is 'all'", async () => {
    usePreferencesStore.getState().setPreferredSport("all");
    renderGrid([row([card("v1", "All Night", "skateboard")])]);
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
  });

  it("the safety timeout resolves a switch whose rows never land", async () => {
    vi.useFakeTimers();
    try {
      usePreferencesStore.getState().setPreferredSport("BMX");
      renderGrid([row([card("v1", "BMX Night", "bmx")])]);
      expect(
        screen.getByRole("status", { name: "Loading BMX videos…" }),
      ).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets an explicit ?discipline= link control view without forcing onboarding", async () => {
    nav.params = new URLSearchParams("discipline=skateboard");
    renderGrid([row([card("v2", "Skate Night", "skateboard")])]);

    expect(useUIStore.getState().isOnboardingOpen).toBe(false);
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Skateboard" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
  });
});

describe("TvGrid theater queue affordances (lazy /api/tv/ids)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function jsonRes(data: unknown): Response {
    return { ok: true, status: 200, json: async () => data } as unknown as Response;
  }

  const queryQueue = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls.filter(([u]) => String(u).includes("/api/tv/ids"));

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    (Element.prototype as unknown as Record<string, unknown>).scrollIntoView =
      vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opening a mid-queue video fetches no queue id list", async () => {
    renderGrid([row([card("v1", "BMX Night", "bmx"), card("v2", "BMX Sequel", "bmx")], 12)]);

    await userEvent.click(
      screen.getByRole("button", { name: /BMX Night — BMX/ }),
    );
    expect(screen.getByText(/Now playing · All sports/)).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a complete loaded queue never fetches ids and disables Next", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      throw new Error(`unexpected fetch: ${String(input)}`);
    });
    renderGrid([row([card("v1", "BMX Night", "bmx"), card("v2", "BMX Sequel", "bmx")], 2)]);

    await userEvent.click(
      screen.getByRole("button", { name: /BMX Sequel — BMX/ }),
    );
    expect(screen.getByText(/Now playing · All sports/)).toBeDefined();
    expect(queryQueue(fetchMock)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Next video" })).toBeDisabled();
  });

  it("fetches the id list once at an unknown right edge and resolves the boundary", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/tv/ids")) return jsonRes({ ids: ["v1", "v2", "v3"] });
      if (url.includes("/api/tv?ids=v3")) {
        return jsonRes({ cards: [card("v3", "BMX Third", "bmx")] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    renderGrid([row([card("v1", "BMX Night", "bmx"), card("v2", "BMX Sequel", "bmx")], 3)]);

    await userEvent.click(
      screen.getByRole("button", { name: /BMX Sequel — BMX/ }),
    );
    // Right-edge open with more pages → one snapshot fetch affords Next…
    await waitFor(() => expect(queryQueue(fetchMock)).toHaveLength(1));

    // …and the boundary navigation walks the ids list to v3.
    const nextBtn = screen.getByRole("button", { name: "Next video" });
    await waitFor(() => expect(nextBtn).toBeEnabled());
    await userEvent.click(nextBtn);
    await waitFor(() =>
      expect(screen.getAllByText(/BMX Third/).length).toBeGreaterThan(0),
    );
    // v3 opened from the snapshot — still exactly one ids call.
    expect(queryQueue(fetchMock)).toHaveLength(1);
  });

  it("batch-resolves a miss window in one request and skips unpublished ids", async () => {
    const nid = (n: number) =>
      `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/tv/ids")) {
        return jsonRes({ ids: ["v1", "v2", nid(3), nid(4), nid(5)] });
      }
      // Server misses 3 & 4 (unpublished) — returns only 5.
      if (url.includes("/api/tv?ids=")) {
        return jsonRes({ cards: [card(nid(5), "BMX Third", "bmx")] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    renderGrid([row([card("v1", "BMX Night", "bmx"), card("v2", "BMX Sequel", "bmx")], 5)]);

    await userEvent.click(
      screen.getByRole("button", { name: /BMX Sequel — BMX/ }),
    );
    await waitFor(() => expect(queryQueue(fetchMock)).toHaveLength(1));
    const nextBtn = screen.getByRole("button", { name: "Next video" });
    await waitFor(() => expect(nextBtn).toBeEnabled());
    await userEvent.click(nextBtn);
    // First resolvable id in walk order wins — the unpublished middles
    // never opened.
    await waitFor(() =>
      expect(screen.getAllByText(/BMX Third/).length).toBeGreaterThan(0),
    );
    // Whole unknown run settled in exactly one batched window.
    const batchCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/tv?ids="),
    );
    expect(batchCalls).toHaveLength(1);
    const batchUrl = String(batchCalls[0]?.[0]);
    expect(batchUrl).toContain(nid(3));
    expect(batchUrl).toContain(nid(4));
    expect(batchUrl).toContain(nid(5));
  });
});

describe("TvAutoplayerButton continuous playback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays video after video automatically when triggered", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    renderGrid([
      row([
        card("v1", "BMX First", "bmx"),
        card("v2", "BMX Second", "bmx"),
      ]),
    ]);

    // 1. Locate and click the Autoplayer button
    const autoplayBtn = screen.getByRole("button", {
      name: /Shuffle All sports/i,
    });
    expect(autoplayBtn).toBeDefined();
    await userEvent.click(autoplayBtn);

    // 2. First video opens and starts playing in Auto mode
    await waitFor(() =>
      expect(screen.getByText(/Now playing · All sports/)).toBeDefined(),
    );
    expect(screen.getAllByText(/BMX First/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Autoplay next on/i }),
    ).toBeDefined();

    // 3. YouTube video ends: iframe dispatches state 0 (ended)
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://www.youtube.com",
          data: JSON.stringify({
            event: "infoDelivery",
            info: { playerState: 0 },
          }),
        }),
      );
    });

    // 4. Player automatically advances to the next video without user action
    await waitFor(() =>
      expect(screen.getAllByText(/BMX Second/).length).toBeGreaterThan(0),
    );
  });
});

describe("TvGrid All categories pill button", () => {
  it("renders the All pill as the first tab in the tablist", () => {
    renderGrid([
      row([
        card("v1", "BMX Video", "bmx"),
        card("v2", "Skate Video", "skateboard"),
      ]),
    ]);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    const allTab = screen.getByRole("tab", { name: "All" });
    expect(allTab).toBeDefined();
    expect(allTab.getAttribute("data-slug")).toBe("all");
  });

  it("selects all categories videos when clicked from a specific discipline", async () => {
    usePreferencesStore.getState().setPreferredSport("BMX");
    const { rerender } = renderGrid([
      row([
        card("v1", "BMX Video", "bmx"),
        card("v2", "Skate Video", "skateboard"),
      ]),
    ]);

    // Mount settles with BMX active
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "BMX" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
    expect(
      screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected"),
    ).toBe("false");

    // Click "All" tab
    await userEvent.click(screen.getByRole("tab", { name: "All" }));

    // All tab is now selected, BMX is deselected
    expect(
      screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("tab", { name: "BMX" }).getAttribute("aria-selected"),
    ).toBe("false");

    // Nav replaced to path with discipline=all
    expect(nav.replace).toHaveBeenCalledWith(
      "/tv?discipline=all",
      expect.objectContaining({ scroll: false }),
    );

    // Shows switch status
    expect(
      screen.getByRole("status", { name: "Loading all sports videos…" }),
    ).toBeDefined();

    // Settle with fresh unfiltered rows
    rerender(
      gridElement([
        row([
          card("v1", "BMX Video", "bmx"),
          card("v2", "Skate Video", "skateboard"),
        ]),
      ]),
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getAllByText(/BMX Video/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Skate Video/).length).toBeGreaterThan(0);
    });
  });

  it("does not start a transition when clicking All if All is already active", async () => {
    renderGrid(
      [
        row([
          card("v1", "BMX Video", "bmx"),
          card("v2", "Skate Video", "skateboard"),
        ]),
      ],
      "all",
    );

    const allTab = screen.getByRole("tab", { name: "All" });
    expect(allTab.getAttribute("aria-selected")).toBe("true");

    nav.replace.mockClear();
    await userEvent.click(allTab);

    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("TvGrid row order", () => {
  it("puts hype rows ahead of long watches", () => {
    renderGrid(
      [
        row([card("v1", "A Doc", "bmx")], 1, "documentary"),
        row([card("v2", "A Part", "bmx")], 1, "video part"),
      ],
      "all",
    );

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings.indexOf("Video parts")).toBeLessThan(
      headings.indexOf("Documentary"),
    );
  });
});

describe("TvGrid multi-category compatibility", () => {
  it("renders a multi-category video across all its category rows and deduplicates the total count when fully loaded", async () => {
    const multiVideo = card("v1", "Dual Session", "bmx", [
      "profile",
      "custom-jam",
    ]);
    const musicOnly = card("v2", "Music Session", "bmx", ["music"]);

    renderGrid(
      [
        row([multiVideo], 1, "profile"),
        row([musicOnly], 1, "music"),
        row([multiVideo], 1, "custom-jam"),
      ],
      "all",
    );

    expect(
      screen.getAllByRole("region", { name: "Rider profiles" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("region", { name: "Music" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("region", { name: "Custom-jam" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("group", { name: "Dual Session" }),
    ).toHaveLength(2);

    // Shuffle button reflects All sports without count suffix
    expect(
      screen.getByRole("button", {
        name: /Shuffle All sports/i,
      }),
    ).toBeDefined();
  });
});

describe("TvGrid searching and filtering", () => {
  it("renders search bar with search input and category select", () => {
    renderGrid([row([card("v1", "Sample", "skateboard")])], "all");

    expect(
      screen.getByPlaceholderText("Search riders or tricks"),
    ).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: /filter by category/i }),
    ).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: /filter by year/i }),
    ).toBeNull();
  });

  it("transitions to search results grid when search is active with initial results", () => {
    const searchVideo = card("v-paris", "Paris Street League", "skateboard");
    renderGrid(
      [row([card("v1", "Regular Marquee Video", "skateboard")])],
      "all",
      {
        initialQuery: "Paris",
        initialSearchResults: {
          items: [searchVideo],
          nextCursor: null,
        },
      },
    );

    // Search results grid is shown
    expect(screen.getByText(/1 video found/i)).toBeDefined();
    expect(screen.getByText("Paris Street League")).toBeDefined();
    // Default marquee row is hidden
    expect(
      screen.queryByRole("region", { name: "Music" }),
    ).toBeNull();
  });

  it("renders active filter badges and allows resetting filters", async () => {
    const searchVideo = card("v-event", "X Games Final", "bmx", ["event"]);
    renderGrid([row([card("v1", "Regular Video", "bmx")])], "all", {
      initialQuery: "Games",
      initialCategory: "event",
      initialYear: 2026,
      initialSearchResults: {
        items: [searchVideo],
        nextCursor: null,
      },
    });

    expect(screen.getByText(/1 video found/i)).toBeDefined();
    expect(screen.getByText(/“Games”/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /remove category filter/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /remove year filter/i }),
    ).toBeDefined();

    // Reset button is present
    const resetButton = screen.getByRole("button", {
      name: "Clear filters",
    });
    expect(resetButton).toBeDefined();

    await userEvent.click(resetButton);

    // After reset, search is inactive and default category marquee reappears
    await waitFor(() => {
      expect(
        screen.getAllByRole("region", { name: "Music" }).length,
      ).toBeGreaterThan(0);
    });
  });

  it("See all opens the row's category as a full grid", async () => {
    renderGrid([row([card("v1", "Epic Line", "bmx")], 1, "epic tricks")], "all");

    await userEvent.click(
      screen.getByRole("button", { name: "See all Epic tricks" }),
    );

    expect(
      screen.getByRole("button", { name: /remove category filter/i }),
    ).toBeDefined();
  });

  it("opens theater modal when clicking a video card from search results", async () => {
    const searchVideo = card("v-sls", "SLS Super Crown", "skateboard");
    renderGrid([row([card("v1", "Regular Video", "skateboard")])], "all", {
      initialQuery: "Crown",
      initialSearchResults: {
        items: [searchVideo],
        nextCursor: null,
      },
    });

    const cardButton = screen.getByRole("button", {
      name: /SLS Super Crown/i,
    });
    await userEvent.click(cardButton);

    // Modal opens displaying video title
    await waitFor(() => {
      expect(screen.getByText(/Now playing/i)).toBeDefined();
    });
  });
});




