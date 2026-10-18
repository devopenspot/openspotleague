import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameState, GameStage } from "@/lib/schemas/game";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

  it("closes the dialog when clicking View board", () => {
    const onClose = vi.fn();
    render(<AwardDialog isOpen game={gameFixture()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "View board" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
