import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { showToastMock, hapticMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  hapticMock: vi.fn(),
}));

vi.mock("@/hooks/ui/useToast", () => ({ showToast: showToastMock }));
vi.mock("@/lib/utils/haptics", () => ({ haptic: hapticMock }));

import {
  RESULT_UNDO_MS,
  resultWasApplied,
  usePendingResult,
  type ResultSubmission,
} from "@/components/games/hooks/usePendingResult";
import type { GameState } from "@/lib/schemas/game";

function setup(outcome: ResultSubmission | Error = "sent", roundId = "round-1") {
  const submit = vi.fn(async () => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  const hook = renderHook(
    ({ id }: { id: string | null }) => usePendingResult({ roundId: id, submit }),
    { initialProps: { id: roundId as string | null } },
  );
  return { ...hook, submit };
}

const expire = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(RESULT_UNDO_MS);
  });

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  showToastMock.mockReset();
  hapticMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("usePendingResult", () => {
  it("shows the result immediately and sends nothing during the window", async () => {
    const { result, submit } = setup();

    act(() => result.current.mark("failed", "attempt"));

    expect(result.current.pending).toMatchObject({
      result: "failed",
      kind: "attempt",
      status: "counting",
    });
    expect(hapticMock).toHaveBeenCalledWith("tap");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULT_UNDO_MS - 1);
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("sends once the window ends, then clears", async () => {
    const { result, submit } = setup();

    act(() => result.current.mark("landed", "challenge"));
    await expire();

    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: "round-1",
        result: "landed",
        kind: "challenge",
      }),
    );
    expect(result.current.pending).toBeNull();
  });

  it("never sends a result the rider undid", async () => {
    const { result, submit } = setup();

    act(() => result.current.mark("failed", "attempt"));
    act(() => result.current.undo());
    await expire();

    expect(submit).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
    expect(hapticMock).toHaveBeenLastCalledWith("undo");
  });

  it("ignores a second tap during the window", async () => {
    const { result, submit } = setup();

    act(() => result.current.mark("failed", "attempt"));
    act(() => result.current.mark("landed", "attempt"));

    expect(result.current.pending?.result).toBe("failed");
    await expire();
    expect(submit).toHaveBeenCalledOnce();
  });

  it("lets the rider correct a mis-tap by undoing first", async () => {
    const { result, submit } = setup();

    act(() => result.current.mark("failed", "attempt"));
    act(() => result.current.undo());
    act(() => result.current.mark("landed", "attempt"));
    await expire();

    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ result: "landed" }),
    );
  });

  it("sends straight away when the phone is locked", async () => {
    const { result, submit } = setup();

    act(() => result.current.mark("landed", "attempt"));
    await act(async () => setVisibility("hidden"));

    expect(submit).toHaveBeenCalledOnce();

    await expire();
    expect(submit).toHaveBeenCalledOnce();
  });

  it("sends straight away when the rider leaves the board", async () => {
    const { result, submit, unmount } = setup();

    act(() => result.current.mark("landed", "attempt"));
    await act(async () => unmount());

    expect(submit).toHaveBeenCalledOnce();
  });

  it("drops the result with a notice if the round moves on", async () => {
    const { result, submit, rerender } = setup();

    act(() => result.current.mark("landed", "attempt"));
    rerender({ id: "round-2" });

    expect(result.current.pending).toBeNull();
    expect(showToastMock).toHaveBeenCalledWith(
      "The Round Moved On — Your Result Wasn't Sent.",
      "info",
    );
    await expire();
    expect(submit).not.toHaveBeenCalled();
  });

  it("drops the result if the game ends during the window", () => {
    const { result, rerender } = setup();

    act(() => result.current.mark("landed", "attempt"));
    rerender({ id: null });

    expect(result.current.pending).toBeNull();
  });

  it("does nothing without a round", () => {
    const { result } = setup("sent", "");
    act(() => result.current.mark("landed", "attempt"));
    expect(result.current.pending).toBeNull();
  });

  it("keeps the result when no request got through, then resends it", async () => {
    const { result, submit } = setup("unsent");

    act(() => result.current.mark("failed", "attempt"));
    await expire();

    expect(result.current.pending?.status).toBe("unsent");

    await act(async () => {
      await result.current.resend();
    });

    expect(submit).toHaveBeenCalledTimes(2);
    expect(result.current.pending?.status).toBe("unsent");
  });

  it("treats a thrown submission as unsent", async () => {
    const { result } = setup(new Error("offline"));

    act(() => result.current.mark("landed", "attempt"));
    await expire();

    expect(result.current.pending?.status).toBe("unsent");
  });

  it("lets the rider discard an unsent result", async () => {
    const { result } = setup("unsent");

    act(() => result.current.mark("failed", "attempt"));
    await expire();
    act(() => result.current.undo());

    expect(result.current.pending).toBeNull();
  });

  it("clears an unsent result quietly once the round has moved on", async () => {
    const { result, rerender } = setup("unsent");

    act(() => result.current.mark("landed", "attempt"));
    await expire();
    rerender({ id: "round-2" });

    expect(result.current.pending).toBeNull();
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe("resultWasApplied", () => {
  const entry = { roundId: "round-1", kind: "attempt" } as const;
  const game = (round: unknown) =>
    ({ viewerPlayerId: "rider", currentRound: round }) as unknown as GameState;

  it("can't tell without a game", () => {
    expect(resultWasApplied(null, entry)).toBe(false);
  });

  it("is true once the round has moved on or the game has none", () => {
    expect(resultWasApplied(game({ id: "round-2" }), entry)).toBe(true);
    expect(resultWasApplied(game(null), entry)).toBe(true);
  });

  it("checks for the viewer's attempt", () => {
    expect(
      resultWasApplied(game({ id: "round-1", attempts: [] }), entry),
    ).toBe(false);
    expect(
      resultWasApplied(
        game({ id: "round-1", attempts: [{ playerId: "rider" }] }),
        entry,
      ),
    ).toBe(true);
  });

  it("checks the round left challenge_open for a challenger", () => {
    const challenge = { ...entry, kind: "challenge" } as const;
    expect(
      resultWasApplied(
        game({ id: "round-1", status: "challenge_open" }),
        challenge,
      ),
    ).toBe(false);
    expect(
      resultWasApplied(
        game({ id: "round-1", status: "collecting_results" }),
        challenge,
      ),
    ).toBe(true);
  });
});
