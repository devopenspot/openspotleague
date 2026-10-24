import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TvAdminClient } from "./TvAdminClient";
import type { TvVideo } from "@/types/tv";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}));

const disciplines = [
  { slug: "skateboard", name: "Skateboard" },
  { slug: "roller", name: "Roller" },
  { slug: "bmx", name: "BMX" },
  { slug: "scooter", name: "Scooter" },
];

function makeVideo(overrides: Partial<TvVideo> = {}): TvVideo {
  return {
    id: "v-1",
    title: "Awesome Skate Video",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    disciplineSlug: "skateboard",
    categories: ["profile", "event"],
    postDate: "2026-01-01T00:00:00.000Z",
    published: true,
    sortOrder: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TvAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompt to select discipline when no discipline is selected", () => {
    render(
      <TvAdminClient
        initialVideos={[]}
        disciplines={disciplines}
      />
    );

    expect(screen.getByText("Select a discipline to view videos")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Skateboard")).toBeDefined();
    expect(screen.getByText("Roller")).toBeDefined();
  });

  it("renders table with videos when a discipline is active", () => {
    const video = makeVideo({ title: "Baker 4 Full Video" });
    render(
      <TvAdminClient
        initialVideos={[video]}
        disciplines={disciplines}
        selectedDiscipline="skateboard"
      />
    );

    expect(screen.queryByText("Select a discipline to view videos")).toBeNull();
    expect(screen.getByText("Baker 4 Full Video")).toBeDefined();
    expect(screen.getByRole("table")).toBeDefined();
  });

  it("navigates with searchParams when a discipline is clicked", () => {
    render(
      <TvAdminClient
        initialVideos={[]}
        disciplines={disciplines}
      />
    );

    const skateButton = screen.getByRole("button", { name: /skateboard/i });
    fireEvent.click(skateButton);

    expect(mockReplace).toHaveBeenCalledWith("/admin/tv?discipline=skateboard", { scroll: false });
  });

  it("fetches and displays counts asynchronously on hover or touch", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skateboard: 42, roller: 18 }),
    });
    vi.stubGlobal("fetch", fakeFetch);

    render(
      <TvAdminClient
        initialVideos={[]}
        disciplines={disciplines}
      />
    );

    // Initial render: no count badges
    expect(screen.queryByText("42")).toBeNull();

    // Trigger onMouseEnter
    const skateButton = screen.getByRole("button", { name: /skateboard/i });
    fireEvent.mouseEnter(skateButton);

    await waitFor(() => {
      expect(fakeFetch).toHaveBeenCalledWith("/api/admin/tv/counts");
      expect(screen.getByText("42")).toBeDefined();
      expect(screen.getByText("18")).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it("renders dynamic category filters and excludes unrepresented hardcoded categories", () => {
    const video = makeVideo({ disciplineSlug: "skateboard", categories: ["raw-cut", "street"] });
    render(
      <TvAdminClient
        initialVideos={[video]}
        disciplines={disciplines}
        selectedDiscipline="skateboard"
        availableCategories={["raw-cut", "street"]}
      />
    );

    // Dynamic category buttons rendered
    expect(screen.getByRole("button", { name: /^all$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^raw-cut$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^street$/i })).toBeDefined();

    // Hardcoded categories not in availableCategories should NOT exist
    expect(screen.queryByRole("button", { name: /^music$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^lifestyle$/i })).toBeNull();
  });

  it("renders empty notice when availableCategories is empty for an active discipline", () => {
    render(
      <TvAdminClient
        initialVideos={[]}
        disciplines={disciplines}
        selectedDiscipline="skateboard"
        availableCategories={[]}
      />
    );

    expect(screen.getByText("No categories recorded")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^all$/i })).toBeNull();
  });

  it("navigates with discipline and category query params when dynamic category is clicked", () => {
    const video = makeVideo({ disciplineSlug: "skateboard", categories: ["raw-cut"] });
    render(
      <TvAdminClient
        initialVideos={[video]}
        disciplines={disciplines}
        selectedDiscipline="skateboard"
        availableCategories={["raw-cut"]}
      />
    );

    const rawCutButton = screen.getByRole("button", { name: /^raw-cut$/i });
    fireEvent.click(rawCutButton);

    expect(mockReplace).toHaveBeenCalledWith("/admin/tv?discipline=skateboard&category=raw-cut", {
      scroll: false,
    });
  });
});
