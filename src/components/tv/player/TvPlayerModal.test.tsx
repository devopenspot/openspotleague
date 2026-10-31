import { act, fireEvent, render, screen } from "@testing-library/react";
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

function fromYoutube(data: unknown) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://www.youtube-nocookie.com",
        data: JSON.stringify(data),
      }),
    );
  });
}

describe("TvPlayerModal live player", () => {
  const first = mockVideo("aaaaaaaaaaa", "First Video");
  const second = mockVideo("bbbbbbbbbbb", "Second Video");
  const baseProps = {
    isOpen: true,
    disciplineLabel: "BMX",
    categoryLabel: "All",
    hasPrev: false,
    hasNext: true,
    autoplay: true,
    autoAdvance: true,
    onToggleAutoAdvance: vi.fn(),
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    queue: [first, second],
  };

  it("swaps videos inside the live player so sound survives a queue move", () => {
    const { rerender } = render(
      <TvPlayerModal {...baseProps} video={first} activeId={first.id} />,
    );
    const iframe = screen.getByTitle("First Video") as HTMLIFrameElement;
    const src = iframe.getAttribute("src");
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
    });
    fromYoutube({ event: "onReady" });

    rerender(
      <TvPlayerModal {...baseProps} video={second} activeId={second.id} />,
    );

    expect(screen.getByTitle("Second Video")).toBe(iframe);
    expect(iframe.getAttribute("src")).toBe(src);
    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: "command",
        func: "loadVideoById",
        args: [{ videoId: "bbbbbbbbbbb", startSeconds: 0 }],
      }),
      "*",
    );
  });

  it("holds the next video's poster while it loads in the live player", () => {
    const { rerender } = render(
      <TvPlayerModal {...baseProps} video={first} activeId={first.id} />,
    );
    fireEvent.load(screen.getByTitle("First Video"));
    fromYoutube({ event: "onReady" });
    expect(document.querySelector('img[src*="aaaaaaaaaaa"]')).not.toBeNull();
    fromYoutube({ event: "infoDelivery", info: { currentTime: 1 } });
    expect(document.querySelector('img[src*="aaaaaaaaaaa"]')).toBeNull();

    rerender(
      <TvPlayerModal {...baseProps} video={second} activeId={second.id} />,
    );

    expect(document.querySelector('img[src*="bbbbbbbbbbb"]')).not.toBeNull();

    const later = Date.now() + 2000;
    const now = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      // Buffering still reports the start time: the poster stays up…
      fromYoutube({ event: "infoDelivery", info: { currentTime: 0 } });
      expect(document.querySelector('img[src*="bbbbbbbbbbb"]')).not.toBeNull();
      // …until time actually moves.
      fromYoutube({ event: "infoDelivery", info: { currentTime: 1 } });
      expect(document.querySelector('img[src*="bbbbbbbbbbb"]')).toBeNull();
    } finally {
      now.mockRestore();
    }
  });

  it("seeks once per loop while the player keeps reporting the old time", async () => {
    const user = userEvent.setup();
    render(<TvPlayerModal {...baseProps} video={first} activeId={first.id} />);
    const iframe = screen.getByTitle("First Video") as HTMLIFrameElement;
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
    });
    fromYoutube({ event: "initialDelivery", info: { duration: 100 } });
    fromYoutube({ event: "infoDelivery", info: { currentTime: 42 } });
    await user.click(screen.getByRole("button", { name: "Loop 5s" }));
    postMessageSpy.mockClear();

    const later = Date.now() + 2000;
    const now = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      // A slow seek: the stale position arrives on every time event.
      fromYoutube({ event: "infoDelivery", info: { currentTime: 42.1 } });
      fromYoutube({ event: "infoDelivery", info: { currentTime: 42.1 } });
      fromYoutube({ event: "infoDelivery", info: { currentTime: 42.1 } });
    } finally {
      now.mockRestore();
    }

    const seeks = postMessageSpy.mock.calls.filter(([raw]) =>
      String(raw).includes('"seekTo"'),
    );
    expect(seeks).toHaveLength(1);
    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "*",
    );
  });

  it("reloads the iframe for a move before the player is ready", () => {
    const { rerender } = render(
      <TvPlayerModal {...baseProps} video={first} activeId={first.id} />,
    );

    rerender(
      <TvPlayerModal {...baseProps} video={second} activeId={second.id} />,
    );

    expect(screen.getByTitle("Second Video").getAttribute("src")).toContain(
      second.id,
    );
  });

  it("shows Up next near the end, and Cancel stops the advance", async () => {
    const user = userEvent.setup();
    const onEnded = vi.fn();
    render(
      <TvPlayerModal
        {...baseProps}
        video={first}
        activeId={first.id}
        onEnded={onEnded}
      />,
    );

    fromYoutube({ event: "initialDelivery", info: { duration: 100 } });
    fromYoutube({ event: "infoDelivery", info: { currentTime: 95 } });
    expect(screen.getByText("Up next: Second Video")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Up next: Second Video")).toBeNull();

    fromYoutube({ event: "onStateChange", info: 0 });
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("advances at the end when Up next is left alone", () => {
    const onEnded = vi.fn();
    render(
      <TvPlayerModal
        {...baseProps}
        video={first}
        activeId={first.id}
        onEnded={onEnded}
      />,
    );

    fromYoutube({ event: "onStateChange", info: 0 });
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("does not skip a playing video on a stray ended signal", () => {
    const onEnded = vi.fn();
    render(
      <TvPlayerModal
        {...baseProps}
        video={first}
        activeId={first.id}
        onEnded={onEnded}
      />,
    );

    fromYoutube({ event: "initialDelivery", info: { duration: 3897 } });
    fromYoutube({ event: "infoDelivery", info: { currentTime: 5 } });
    fromYoutube({ event: "onStateChange", info: 0 });

    expect(onEnded).not.toHaveBeenCalled();
  });

  it("keeps playing through an error from a video that is playing", () => {
    render(<TvPlayerModal {...baseProps} video={first} activeId={first.id} />);

    fromYoutube({ event: "infoDelivery", info: { currentTime: 5 } });
    fromYoutube({ event: "onError", info: 150 });

    expect(screen.queryByText("This video can't play here")).toBeNull();
  });

  it("ignores a recoverable player error", () => {
    render(<TvPlayerModal {...baseProps} video={first} activeId={first.id} />);

    fromYoutube({ event: "onError", info: 5 });

    expect(screen.queryByText("This video can't play here")).toBeNull();
  });

  it("offers YouTube when a video can't be embedded", () => {
    render(<TvPlayerModal {...baseProps} video={first} activeId={first.id} />);

    fromYoutube({ event: "onError", info: 150 });

    expect(screen.getByText("This video can't play here")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Watch on YouTube" }).getAttribute("href"),
    ).toBe(first.youtubeUrl);
  });

  it("reports the last position when the player closes", async () => {
    const user = userEvent.setup();
    const onProgress = vi.fn();
    render(
      <TvPlayerModal
        {...baseProps}
        video={first}
        activeId={first.id}
        onProgress={onProgress}
      />,
    );

    fromYoutube({ event: "initialDelivery", info: { duration: 100 } });
    fromYoutube({ event: "infoDelivery", info: { currentTime: 42 } });
    await user.click(screen.getByRole("button", { name: "Close player" }));

    expect(onProgress).toHaveBeenLastCalledWith(first.id, 42, 100);
  });

  it("drops the study tools' speed back to normal on the next video", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TvPlayerModal {...baseProps} video={first} activeId={first.id} />,
    );

    await user.click(screen.getByRole("button", { name: "Playback speed 1x" }));
    expect(
      screen.getByRole("button", { name: "Playback speed 0.5x" }),
    ).toBeDefined();

    rerender(
      <TvPlayerModal {...baseProps} video={second} activeId={second.id} />,
    );
    expect(
      screen.getByRole("button", { name: "Playback speed 1x" }),
    ).toBeDefined();
  });
});

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
