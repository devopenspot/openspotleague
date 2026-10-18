import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TvCard } from "@/types/tv";
import { TvQueueStrip } from "./TvQueueStrip";

function mockCard(id: string, title: string, categories: TvCard["categories"] = ["music"]): TvCard {
  return {
    id,
    title,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    disciplineSlug: "bmx",
    categories,
    postDate: "2026-01-01T00:00:00.000Z",
  };
}

describe("TvQueueStrip", () => {
  const queue = [
    mockCard("v1", "First Video"),
    mockCard("v2", "Second Video"),
  ];

  it("renders queue items with honest total count in aria-label", () => {
    render(
      <TvQueueStrip
        queue={queue}
        activeId="v1"
        onSelect={vi.fn()}
        total={50}
      />,
    );

    expect(screen.getByRole("group", { name: "1 of 50: First Video" })).toBeDefined();
    expect(screen.getByRole("group", { name: "2 of 50: Second Video" })).toBeDefined();
  });

  it("highlights the active item", () => {
    render(
      <TvQueueStrip
        queue={queue}
        activeId="v2"
        onSelect={vi.fn()}
      />,
    );

    const activeItem = screen.getByRole("group", { name: "2 of 2: Second Video" });
    expect(activeItem.getAttribute("aria-current")).toBe("true");

    const inactiveItem = screen.getByRole("group", { name: "1 of 2: First Video" });
    expect(inactiveItem.getAttribute("aria-current")).toBeNull();
  });

  it("calls onSelect when an item is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <TvQueueStrip
        queue={queue}
        activeId="v1"
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("group", { name: "2 of 2: Second Video" }));
    expect(onSelect).toHaveBeenCalledWith("v2");
  });

  it("shows skeleton loading card when isLoadingMore is true", () => {
    render(
      <TvQueueStrip
        queue={queue}
        activeId="v1"
        onSelect={vi.fn()}
        hasMore
        isLoadingMore
      />,
    );

    expect(screen.getByRole("status", { name: "Loading more videos…" })).toBeDefined();
  });

  it("triggers onLoadMore on scroll when nearing the end", () => {
    const onLoadMore = vi.fn();
    render(
      <TvQueueStrip
        queue={queue}
        activeId="v1"
        onSelect={vi.fn()}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    const region = screen.getByRole("region", { name: "Video queue" });
    Object.defineProperty(region, "scrollLeft", { value: 500, configurable: true });
    Object.defineProperty(region, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(region, "scrollWidth", { value: 1000, configurable: true });

    fireEvent.scroll(region);
    expect(onLoadMore).toHaveBeenCalled();
  });
});
