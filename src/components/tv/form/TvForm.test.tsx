import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TvVideo } from "@/types/tv";
import { TvForm } from "./TvForm";
import { TvAdminClient } from "./TvAdminClient";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const disciplines = [
  { slug: "roller", name: "Roller" },
  { slug: "skateboard", name: "Skateboard" },
];

function makeTvVideo(overrides: Partial<TvVideo> = {}): TvVideo {
  return {
    id: "tv-1",
    title: "Street Session",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    disciplineSlug: "roller",
    categories: ["profile", "street-edit"],
    postDate: "2026-02-10T00:00:00.000Z",
    published: true,
    sortOrder: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("TvForm multi-categories", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshMock.mockClear();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ video: makeTvVideo() }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows typing custom categories, adding multiple categories, and submitting them", async () => {
    const onDone = vi.fn();
    render(<TvForm disciplines={disciplines} onDone={onDone} />);

    // Default starts with "profile"
    expect(screen.getByRole("button", { name: "Remove profile" })).toBeDefined();

    // Type a custom category and click Add
    const catInput = screen.getByRole("textbox", { name: "Category input" });
    await userEvent.type(catInput, "Street Jam");
    await userEvent.click(screen.getByRole("button", { name: "Add category" }));

    expect(
      screen.getByRole("button", { name: "Remove street jam" }),
    ).toBeDefined();

    // Type another category and press Enter
    await userEvent.type(catInput, "raw-clips{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove raw-clips" }),
    ).toBeDefined();

    // Toggle a suggested category ("event")
    await userEvent.click(screen.getByRole("button", { name: "event" }));
    expect(screen.getByRole("button", { name: "Remove event" })).toBeDefined();

    // Fill required fields and submit
    await userEvent.type(screen.getByPlaceholderText("Video title"), "My Edit");
    await userEvent.type(
      screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    await userEvent.click(screen.getByRole("button", { name: "Add video" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/tv");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as { categories: string[] };
    expect(body.categories).toEqual([
      "profile",
      "street jam",
      "raw-clips",
      "event",
    ]);
    expect(onDone).toHaveBeenCalled();
  });

  it("merges pending typed category input on submit and blocks empty categories", async () => {
    render(<TvForm disciplines={disciplines} />);

    // Remove the default "profile" category
    await userEvent.click(screen.getByRole("button", { name: "Remove profile" }));

    await userEvent.type(screen.getByPlaceholderText("Video title"), "My Edit");
    await userEvent.type(
      screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    // Submitting with 0 categories shows validation error
    await userEvent.click(screen.getByRole("button", { name: "Add video" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "At least one category is required",
    );

    // Type a category without clicking Add, then submit directly
    const catInput = screen.getByRole("textbox", { name: "Category input" });
    await userEvent.type(catInput, "tour, highlight");
    await userEvent.click(screen.getByRole("button", { name: "Add video" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { categories: string[] };
    expect(body.categories).toEqual(["tour", "highlight"]);
  });
});

describe("TvAdminClient multi-categories display", () => {
  it("renders all categories for each video in the admin table", () => {
    render(
      <TvAdminClient
        initialVideos={[
          makeTvVideo({
            id: "tv-1",
            title: "Multi Cat Video",
            categories: ["profile", "event", "custom-tag"],
          }),
        ]}
        disciplines={disciplines}
      />,
    );

    expect(screen.getByText("Categories")).toBeDefined();
    expect(screen.getAllByText("profile").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("event").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("custom-tag")).toBeDefined();
  });
});
