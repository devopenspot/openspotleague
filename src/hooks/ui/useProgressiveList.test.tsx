import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProgressiveList } from "./useProgressiveList";

type IntersectionEntry = { isIntersecting: boolean };
type IntersectionCallback = (entries: IntersectionEntry[]) => void;

const ioCallbacks: IntersectionCallback[] = [];

class FakeIntersectionObserver {
  constructor(callback: IntersectionCallback) {
    ioCallbacks.push(callback);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function latestCallback(): IntersectionCallback {
  const callback = ioCallbacks.at(-1);
  if (!callback) throw new Error("no IntersectionObserver registered");
  return callback;
}

function makeItems(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `item-${String(i).padStart(3, "0")}`);
}

interface HarnessProps {
  list: string[];
  initial: number;
  step: number;
}

function HookHarness({ list, initial, step }: HarnessProps) {
  const { visible, hasMore, sentinelRef } = useProgressiveList(list, {
    initial,
    step,
  });
  return (
    <ul>
      {visible.map((item) => (
        <li key={item}>{item}</li>
      ))}
      {hasMore && <li ref={sentinelRef} aria-hidden="true" className="h-0" />}
    </ul>
  );
}

// The aria-hidden sentinel is excluded from a11y queries, so role queries
// count exactly the rendered data rows.
function renderList(list: string[], initial = 40, step = 40) {
  return render(<HookHarness list={list} initial={initial} step={step} />);
}

function sentinelFlag(container: HTMLElement): boolean {
  return container.querySelector("li.h-0") !== null;
}

describe("useProgressiveList", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      FakeIntersectionObserver as unknown as typeof IntersectionObserver,
    );
  });

  afterEach(() => {
    ioCallbacks.length = 0;
    vi.unstubAllGlobals();
  });

  it("renders lists at or below the initial chunk fully, with no observer", () => {
    const list = makeItems(10);
    const { container } = renderList(list);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(sentinelFlag(container)).toBe(false);
    expect(ioCallbacks).toHaveLength(0);
  });

  it("renders only the initial chunk for longer lists and registers the sentinel observer", () => {
    const list = makeItems(100);
    const { container } = renderList(list);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(40);
    expect(rows[0]?.textContent).toBe("item-000");
    expect(rows[39]?.textContent).toBe("item-039");
    expect(sentinelFlag(container)).toBe(true);
    expect(ioCallbacks).toHaveLength(1);
  });

  it("ignores non-intersecting sentinel entries", () => {
    const { container } = renderList(makeItems(100));

    act(() => {
      latestCallback()([{ isIntersecting: false }]);
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(40);
    expect(sentinelFlag(container)).toBe(true);
  });

  it("reveals the next chunk when the sentinel intersects and re-registers", () => {
    const list = makeItems(100);
    const { container } = renderList(list);

    act(() => {
      latestCallback()([{ isIntersecting: true }]);
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(80);
    expect(sentinelFlag(container)).toBe(true);
    expect(ioCallbacks).toHaveLength(2);

    act(() => {
      latestCallback()([{ isIntersecting: true }]);
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(100); // exhausted: sentinel gone
    expect(sentinelFlag(container)).toBe(false);
  });

  it("restarts from the initial chunk when the dataset changes", () => {
    const first = makeItems(100);
    const { rerender, container } = renderList(first);

    act(() => {
      latestCallback()([{ isIntersecting: true }]);
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(80);

    const second = makeItems(120);
    rerender(<HookHarness list={second} initial={40} step={40} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(40);
    expect(rows[0]?.textContent).toBe("item-000");
    expect(rows[39]?.textContent).toBe("item-039");
    expect(sentinelFlag(container)).toBe(true);
  });

  it("reveals step-wise on the frame-paced timer cascade without IntersectionObserver", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);

    try {
      const list = makeItems(100);
      const { container } = renderList(list);
      expect(screen.getAllByRole("listitem")).toHaveLength(40);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16);
      });
      // The frame delay reveals exactly one chunk per advance (no burst).
      expect(screen.getAllByRole("listitem")).toHaveLength(80);
      expect(sentinelFlag(container)).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16);
      });
      expect(screen.getAllByRole("listitem")).toHaveLength(100);
      expect(sentinelFlag(container)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders shrunken datasets fully once they fit the initial chunk", () => {
    const list = makeItems(50);
    const { rerender, container } = renderList(list);
    expect(screen.getAllByRole("listitem")).toHaveLength(40);
    expect(sentinelFlag(container)).toBe(true);

    const shorter = makeItems(30);
    rerender(<HookHarness list={shorter} initial={40} step={40} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(30);
    expect(sentinelFlag(container)).toBe(false);
    // No new observer for the shrunken dataset: the log still holds only
    // the one registered for the first render.
    expect(ioCallbacks).toHaveLength(1);
  });
});
