import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TvCard } from "@/types/tv";
import { TvCategoryMarquee } from "./TvCategoryMarquee";

function card(id: string, title: string, disciplineSlug: string): TvCard {
  return {
    id,
    title,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    disciplineSlug,
    categories: ["music", "profile"],
    postDate: "2026-01-05T12:00:00.000Z",
  };
}

function renderMarquee(
  videos: readonly TvCard[],
  discipline: string,
  cursor: string | null = null,
) {
  return render(
    <TvCategoryMarquee
      category="music"
      videos={videos}
      initialCursor={cursor}
      discipline={discipline}
      activeId={null}
      onSelect={vi.fn()}
      onAppend={vi.fn()}
    />,
  );
}

describe("TvCategoryMarquee", () => {
  it("adopts fresh server rows when props change (discipline refetch)", () => {
    const { rerender } = renderMarquee(
      [card("a1", "First Session", "bmx")],
      "bmx",
    );
    expect(
      screen.getByRole("group", { name: "First Session" }),
    ).toBeDefined();

    // Same component instance (same key family), new server payload — e.g.
    // the RSC refetch landing after a discipline switch.
    rerender(
      <TvCategoryMarquee
        category="music"
        videos={[card("b1", "Second Session", "skateboard")]}
        initialCursor={null}
        discipline="skateboard"
        activeId={null}
        onSelect={vi.fn()}
        onAppend={vi.fn()}
      />,
    );

    expect(screen.queryByRole("group", { name: "First Session" })).toBeNull();
    expect(
      screen.getByRole("group", { name: "Second Session" }),
    ).toBeDefined();
  });

  it("renders nothing when the filtered row is empty", () => {
    const { container } = renderMarquee([], "bmx");
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("TvCategoryMarquee pagination guards", () => {
  let ioCallback: IntersectionObserverCallback | null = null;
  let ioOptions: IntersectionObserverInit | null = null;
  const signals: AbortSignal[] = [];
  const deferreds: {
    promise: Promise<Response>;
    resolve: (value: Response) => void;
  }[] = [];

  class FakeIO {
    constructor(
      cb: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      ioCallback = cb;
      ioOptions = options ?? null;
    }
    observe(): void {}
    disconnect(): void {
      ioCallback = null;
    }
    unobserve(): void {}
  }

  function hit() {
    ioCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  }

  function jsonRes(data: unknown): Response {
    return { ok: true, status: 200, json: async () => data } as unknown as Response;
  }

  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    void input;
    if (init?.signal) signals.push(init.signal);
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((res) => {
      resolve = res;
    });
    deferreds.push({ promise, resolve });
    return promise;
  });

  function setup(
    videos: readonly TvCard[],
    cursor: string | null = "next-cursor",
  ) {
    ioCallback = null;
    ioOptions = null;
    signals.length = 0;
    deferreds.length = 0;
    fetchMock.mockClear();
    vi.stubGlobal("IntersectionObserver", FakeIO);
    vi.stubGlobal("fetch", fetchMock);
    return render(
      <TvCategoryMarquee
        category="music"
        videos={videos}
        initialCursor={cursor}
        discipline="all"
        activeId={null}
        onSelect={vi.fn()}
        onAppend={vi.fn()}
      />,
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefetches with the tightened root margin", () => {
    setup([card("a1", "First Session", "bmx")]);
    expect(ioOptions?.rootMargin).toBe("0px 200px 0px 0px");
  });

  it("fires at most one page request while one is in flight", async () => {
    setup([card("a1", "First Session", "bmx")]);
    hit();
    hit();
    hit();
    // All three callbacks, a single in-flight page request.
    expect(deferreds).toHaveLength(1);
    deferreds[0]?.resolve(
      jsonRes({ items: [card("a2", "Second Session", "bmx")], nextCursor: null }),
    );
    await screen.findByRole("group", { name: "Second Session" });
  });

  it("aborts an in-flight prefetch when the server row is replaced", async () => {
    const { rerender } = setup([card("a1", "First Session", "bmx")]);
    hit();
    expect(deferreds).toHaveLength(1);
    const signal = signals[0];
    expect(signal?.aborted).toBe(false);

    rerender(
      <TvCategoryMarquee
        category="music"
        videos={[card("b1", "Second Session", "skateboard")]}
        initialCursor={null}
        discipline="skateboard"
        activeId={null}
        onSelect={vi.fn()}
        onAppend={vi.fn()}
      />,
    );
    expect(signal?.aborted).toBe(true);

    // The aborted response lands without appending into the fresh row.
    const pending = deferreds[0];
    if (!pending) throw new Error("no in-flight request captured");
    pending.resolve(
      jsonRes({ items: [card("zz", "Crossing Page", "bmx")], nextCursor: null }),
    );
    await pending.promise;
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByRole("group", { name: "Crossing Page" })).toBeNull();
    expect(screen.getByRole("group", { name: "Second Session" })).toBeDefined();
  });
});
