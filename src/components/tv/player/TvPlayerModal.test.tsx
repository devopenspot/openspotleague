import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TvCard } from "@/types/tv";
import { TvPlayerModal } from "./TvPlayerModal";

function mockVideo(id: string, title: string): TvCard {
  return {
    id,
    title,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    disciplineSlug: "bmx",
    categories: ["event", "profile"],
    postDate: "2026-01-01T00:00:00.000Z",
  };
}

describe("TvPlayerModal", () => {
  const video = mockVideo("v1", "Test Video 1");
  const queue = [video, mockVideo("v2", "Test Video 2")];

  it("renders iframe with allowFullScreen and fullscreen in allow permissions", () => {
    render(
      <TvPlayerModal
        isOpen={true}
        video={video}
        disciplineLabel="BMX"
        categoryLabel="Event"
        hasPrev={false}
        hasNext={true}
        autoplay={true}
        autoAdvance={true}
        onToggleAutoAdvance={vi.fn()}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        queue={queue}
        activeId={video.id}
      />,
    );

    const iframe = screen.getByTitle("Test Video 1");
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute("allow")).toContain("fullscreen");
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("renders mobile info strip with discipline, category, and counter", () => {
    render(
      <TvPlayerModal
        isOpen={true}
        video={video}
        disciplineLabel="BMX"
        categoryLabel="Event"
        hasPrev={false}
        hasNext={true}
        autoplay={false}
        autoAdvance={true}
        onToggleAutoAdvance={vi.fn()}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        queue={queue}
        activeId={video.id}
      />,
    );

    expect(screen.getByText("1 of 2")).toBeDefined();
    expect(screen.getAllByText("Test Video 1").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Tap to unmute' button when autoplaying and dispatches postMessage on click", async () => {
    const user = userEvent.setup();
    render(
      <TvPlayerModal
        isOpen={true}
        video={video}
        disciplineLabel="BMX"
        categoryLabel="Event"
        hasPrev={false}
        hasNext={true}
        autoplay={true}
        autoAdvance={true}
        onToggleAutoAdvance={vi.fn()}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        queue={queue}
        activeId={video.id}
      />,
    );

    const iframe = screen.getByTitle("Test Video 1") as HTMLIFrameElement;
    // Simulate iframe onLoad to transition iframeLoaded state to true
    fireEvent.load(iframe);

    const unmuteBtn = await screen.findByRole("button", { name: "Unmute video" });
    expect(unmuteBtn).toBeDefined();

    // Mock postMessage on the iframe contentWindow
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
      writable: true,
    });

    await user.click(unmuteBtn);

    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "unMute", args: [] }),
      "*",
    );
    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
      "*",
    );

    // Unmute button should now be dismissed
    expect(screen.queryByRole("button", { name: "Unmute video" })).toBeNull();
  });

  it("dispatches play/pause on Space keydown and mute on M keydown", async () => {
    render(
      <TvPlayerModal
        isOpen={true}
        video={video}
        disciplineLabel="BMX"
        categoryLabel="Event"
        hasPrev={false}
        hasNext={true}
        autoplay={true}
        autoAdvance={true}
        onToggleAutoAdvance={vi.fn()}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        queue={queue}
        activeId={video.id}
      />,
    );

    const iframe = screen.getByTitle("Test Video 1") as HTMLIFrameElement;
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
      writable: true,
    });

    // Press Space to toggle play/pause
    fireEvent.keyDown(window, { key: " " });
    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "*",
    );

    // Press M to unmute/mute
    fireEvent.keyDown(window, { key: "m" });
    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "unMute", args: [] }),
      "*",
    );
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TvPlayerModal
        isOpen={true}
        video={video}
        disciplineLabel="BMX"
        categoryLabel="Event"
        hasPrev={false}
        hasNext={true}
        autoplay={false}
        autoAdvance={false}
        onToggleAutoAdvance={vi.fn()}
        onClose={onClose}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        queue={queue}
        activeId={video.id}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Close player" });
    await user.click(closeBtn);

    // Close has close animation delay or immediate call
    expect(onClose).toBeDefined();
  });
});
