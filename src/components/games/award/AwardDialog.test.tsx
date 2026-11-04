import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameState, GameStage } from "@/lib/schemas/game";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const showToast = vi.fn();
vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToast(...args),
}));

import { AwardDialog } from "@/components/games/award/AwardDialog";

function makePlayer(overrides: Partial<GameState["players"][number]> & { id: string }): GameState["players"][number] {
  return {
    userId: `u-${overrides.id}`,
    displayName: overrides.displayName ?? `Player ${overrides.id}`,
    seatOrder: overrides.seatOrder ?? 0,
    letters: overrides.letters ?? "",
    failedAttempts: overrides.failedAttempts ?? 0,
    status: overrides.status ?? "active",
    ...overrides,
  } as GameState["players"][number];
}

function makeStage(overrides: Partial<GameStage> & { sequence: number; id: string }): GameStage {
  return {
    status: "resolved",
    challengerPlayerId: null,
    spotType: "rails",
    trickId: null,
    trickName: null,
    trickLevel: null,
    challengerResult: "pending",
    challengeOutcome: "resolved",
    leadRetained: false,
    attempts: [],
    scores: [],
    ...overrides,
  } as GameStage;
}

function gameFixture(overrides: Partial<GameState> = {}): GameState {
  const basePlayers: GameState["players"] = [
    makePlayer({ id: "p1", displayName: "Alice", seatOrder: 0 }),
    makePlayer({ id: "p2", displayName: "Bob", seatOrder: 1 }),
  ];
  const base = {
    id: "game-1",
    createdBy: "u-p1",
    creatorDisplayName: "Alice",
    status: "complete",
    version: 1,
    shareCode: "abc123",
    mode: "challenge",
    ruleMode: "flexible",
    trainingVariant: "multiplayer",
    disciplineSlug: "roller",
    challengeKey: "blade",
    gameName: "Play a Blade",
    eliminationWord: "BLADE",
    wordLength: 5,
    catalogId: null,
    spotId: null,
    scheduledStartAt: null,
    timezone: null,
    locationRadiusMeters: null,
    nextSpotType: "rails",
    nextLevel: null,
    availableSpotTypes: [{ slug: "rails", name: "Rails", sortOrder: 1 }],
    currentChallengerPlayerId: null,
    winnerPlayerId: "p1",
    rotationIndex: 0,
    viewerPlayerId: null,
    viewerPoints: null,
    winnerBonus: null,
    viewerIsHost: false,
    players: basePlayers,
    currentRound: null,
    stageLedger: [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 13, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 5, eventTypes: ["response_landed"] },
        ],
        attempts: [
          { playerId: "p1", result: "landed" },
          { playerId: "p2", result: "failed" },
        ],
      }),
    ],
  } as unknown as GameState;
  return { ...base, ...overrides } as GameState;
}

describe("AwardDialog", () => {
  afterEach(() => {
    showToast.mockClear();
    Reflect.deleteProperty(navigator, "share");
  });

  it("renders challenge→/challenges.jpg and training→/trainings.jpg by mode", () => {
    const challenge = gameFixture({ mode: "challenge" });
    const training = gameFixture({ mode: "training", trainingVariant: "multiplayer", winnerPlayerId: "p1" });
    const { rerender } = render(<AwardDialog isOpen game={challenge} onClose={vi.fn()} />);
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/challenges.jpg");
    expect(img?.getAttribute("alt")).toContain("Challenge");

    rerender(<AwardDialog isOpen game={training} onClose={vi.fn()} />);
    // training still has one img with trainings.jpg
    expect(document.querySelectorAll("img")[0]?.getAttribute("src")).toBe("/trainings.jpg");
  });

  it("no-winner keeps same image, switches headline to no champion", () => {
    const noWinner = gameFixture({ status: "cancelled", winnerPlayerId: null, stageLedger: [
      makeStage({ id: "s1", sequence: 1, scores: [{ playerId: "p1", points: 5, eventTypes: ["challenger_landed"] }] }),
    ]});
    render(<AwardDialog isOpen game={noWinner} onClose={vi.fn()} />);
    expect(screen.getByText("Session closed — no champion")).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/challenges.jpg");
  });

  it("is a dialog with labelledBy/describedBy + image alt", () => {
    render(<AwardDialog isOpen game={gameFixture()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "award-dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "award-dialog-subtitle");
    const img = document.querySelector("img");
    expect(img?.getAttribute("alt")).toContain("championship results");
    expect(img?.getAttribute("alt")).not.toBe("");
  });

  it("Escape calls onClose (Overlay forwards)", () => {
    const onClose = vi.fn();
    render(<AwardDialog isOpen game={gameFixture()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("solo renders single card headline Nice session!", () => {
    const solo = gameFixture({
      mode: "training",
      trainingVariant: "solo",
      players: [makePlayer({ id: "p1", displayName: "Solo", seatOrder: 0 })],
      stageLedger: [
        makeStage({ id: "s1", sequence: 1, attempts: [{ playerId: "p1", result: "landed" }], scores: [{ playerId: "p1", points: 8, eventTypes: ["challenger_landed"] }] }),
      ],
      winnerPlayerId: null,
    });
    render(<AwardDialog isOpen game={solo} onClose={vi.fn()} />);
    expect(screen.getByText("Nice session!")).toBeInTheDocument();
  });

  it("tells the viewer where they finished", () => {
    render(<AwardDialog isOpen game={gameFixture({ viewerPlayerId: "p2" })} onClose={vi.fn()} />);
    expect(screen.getByText("You finished 2nd")).toBeInTheDocument();
  });

  it("congratulates a winning viewer", () => {
    render(<AwardDialog isOpen game={gameFixture({ viewerPlayerId: "p1" })} onClose={vi.fn()} />);
    expect(screen.getByText("You won")).toBeInTheDocument();
  });

  it("shows an empty state, not a board of zeros, when nothing was settled", () => {
    const empty = gameFixture({ status: "cancelled", winnerPlayerId: null, viewerPlayerId: "p1", stageLedger: [] });
    render(<AwardDialog isOpen game={empty} onClose={vi.fn()} />);
    expect(screen.getByText("No standings to show for this game.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText(/You finished/)).not.toBeInTheDocument();
  });

  it("on the board: no View board, Share is focused first", () => {
    render(<AwardDialog isOpen context="board" game={gameFixture()} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "View board" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveAttribute("data-autofocus");
  });

  it("the top close button closes the dialog", () => {
    const onClose = vi.fn();
    render(<AwardDialog isOpen game={gameFixture()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays quiet when the native share sheet is dismissed", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<AwardDialog isOpen game={gameFixture()} onClose={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share" }));
    });
    expect(share).toHaveBeenCalledOnce();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("closes the dialog when clicking View board", () => {
    const onClose = vi.fn();
    render(<AwardDialog isOpen game={gameFixture()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "View board" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
