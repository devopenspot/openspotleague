import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/lib/schemas/game";

const mockAction = vi.fn();
let mockGameState: GameState | null = null;
const mockRefreshGameState = vi.fn();
const mockSetError = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "route-game-id" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/games/game-123",
}));

vi.mock("@/components/games/hooks/useGameRealtime", () => ({
  useGameRealtime: () => ({
    game: mockGameState,
    connection: "connected" as const,
    error: null,
    setError: mockSetError,
    latestGameRef: { current: mockGameState },
    refreshGameState: mockRefreshGameState,
  }),
}));

vi.mock("@/components/games/hooks/useGameAction", () => ({
  useGameAction: () => ({
    action: mockAction,
    busy: false,
  }),
}));

vi.mock("@/components/games/hooks/useLocationVerification", () => ({
  useLocationVerification: () => ({
    locationPending: false,
    locationPermission: "granted" as const,
    verifyLocation: vi.fn(),
  }),
}));

vi.mock("@/hooks/ui/useToast", () => ({
  showToast: vi.fn(),
}));

vi.mock("@/components/games/award/AwardDialog", () => ({
  AwardDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="award-dialog-mock">Award Dialog Open</div> : null,
}));

import { GameBoard } from "./GameBoard";

const baseLobbyGame = {
  id: "game-123",
  createdBy: null,
  creatorDisplayName: "Host Skater",
  shareCode: "AUTO_SHARE_CODE_123",
  mode: "challenge",
  ruleMode: "flexible",
  gameFormat: "tricks",
  trainingVariant: "multiplayer",
  disciplineSlug: "skateboard",
  challengeKey: "skate",
  gameName: "Downtown Session",
  eliminationWord: "SKATE",
  wordLength: 5,
  catalogId: "cat-1",
  spotId: "spot-1",
  scheduledStartAt: null,
  timezone: "UTC",
  locationRadiusMeters: 50,
  nextSpotType: "ledge",
  nextLevel: 1,
  selectedCategories: null,
  availableSpotTypes: [{ slug: "ledge", name: "Ledge", sortOrder: 1 }],
  currentChallengerPlayerId: null,
  winnerPlayerId: null,
  rotationIndex: 0,
  viewerPlayerId: null,
  viewerPoints: 0,
  winnerBonus: null,
  viewerIsHost: false,
  players: [
    {
      id: "host-1",
      userId: "host-1",
      displayName: "Host Skater",
      letters: "",
      failedAttempts: 0,
      status: "active",
      seatOrder: 0,
    },
  ],
  currentRound: null,
  stageLedger: [],
  status: "lobby",
  version: 1,
} as unknown as GameState;

const ledger = [
  {
    id: "round-1",
    sequence: 1,
    status: "resolved",
    challengerPlayerId: "host-1",
    spotType: "ledge",
    trickId: "trick-1",
    trickName: "Kickflip",
    trickLevel: 1,
    challengerResult: "landed",
    challengeOutcome: "established",
    leadRetained: true,
    attempts: [],
    scores: [],
  },
] as unknown as GameState["stageLedger"];

describe("GameBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockGameState = { ...baseLobbyGame };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to game.shareCode when the shareCode prop is missing on lobby join", async () => {
    const user = userEvent.setup();
    render(<GameBoard userId="user-2" />);

    const [joinButton] = screen.getAllByRole("button", { name: "Join Crew" });
    await user.click(joinButton as HTMLElement);

    expect(mockAction).toHaveBeenCalledWith("/join", {
      shareCode: "AUTO_SHARE_CODE_123",
    });
  });

  it("prefers the shareCode prop over game.shareCode", async () => {
    const user = userEvent.setup();
    render(<GameBoard userId="user-2" shareCode="URL_CODE" />);

    const [joinButton] = screen.getAllByRole("button", { name: "Join Crew" });
    await user.click(joinButton as HTMLElement);

    expect(mockAction).toHaveBeenCalledWith("/join", { shareCode: "URL_CODE" });
  });

  it("submits the guest name and falls back to game.shareCode when a guest joins", async () => {
    mockGameState = { ...baseLobbyGame, mode: "training" } as GameState;
    const user = userEvent.setup();
    render(<GameBoard userId={null} />);

    const [nameInput] = screen.getAllByPlaceholderText("Pick A Rider Name");
    await user.type(nameInput as HTMLElement, "New Guest");

    const [joinGuestButton] = screen.getAllByRole("button", {
      name: "Join Crew",
    });
    await user.click(joinGuestButton as HTMLElement);

    expect(mockAction).toHaveBeenCalledWith("/join", {
      shareCode: "AUTO_SHARE_CODE_123",
    });
  });

  it("opens the award dialog 350ms after a terminal transition even with rapid re-renders", () => {
    vi.useFakeTimers();

    mockGameState = { ...baseLobbyGame, status: "active", stageLedger: ledger };
    const { rerender } = render(<GameBoard userId="host-1" />);
    expect(screen.queryByTestId("award-dialog-mock")).not.toBeInTheDocument();

    mockGameState = {
      ...baseLobbyGame,
      status: "complete",
      stageLedger: ledger,
      version: 2,
    };
    rerender(<GameBoard userId="host-1" />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    mockGameState = {
      ...baseLobbyGame,
      status: "complete",
      stageLedger: ledger,
      version: 3,
    };
    rerender(<GameBoard userId="host-1" />);

    expect(screen.queryByTestId("award-dialog-mock")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByTestId("award-dialog-mock")).toBeInTheDocument();
  });

  it("opens the award dialog when mounting on an already finished game", () => {
    vi.useFakeTimers();

    mockGameState = {
      ...baseLobbyGame,
      status: "complete",
      stageLedger: ledger,
    };
    render(<GameBoard userId="host-1" />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId("award-dialog-mock")).toBeInTheDocument();
  });

  it("does not reopen the award dialog if it was dismissed in sessionStorage", () => {
    vi.useFakeTimers();
    sessionStorage.setItem("award-dialog:dismissed:game-123", "1");

    mockGameState = {
      ...baseLobbyGame,
      status: "complete",
      stageLedger: ledger,
    };
    render(<GameBoard userId="host-1" />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("award-dialog-mock")).not.toBeInTheDocument();
  });
});
