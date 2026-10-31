import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
    applyGameState: vi.fn(),
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

    const [joinButton] = screen.getAllByRole("button", { name: "Join" });
    await user.click(joinButton as HTMLElement);

    expect(mockAction).toHaveBeenCalledWith("/join", {
      shareCode: "AUTO_SHARE_CODE_123",
    });
  });

  it("prefers the shareCode prop over game.shareCode", async () => {
    const user = userEvent.setup();
    render(<GameBoard userId="user-2" shareCode="URL_CODE" />);

    const [joinButton] = screen.getAllByRole("button", { name: "Join" });
    await user.click(joinButton as HTMLElement);

    expect(mockAction).toHaveBeenCalledWith("/join", { shareCode: "URL_CODE" });
  });

  it("submits the guest name and falls back to game.shareCode when a guest joins", async () => {
    mockGameState = { ...baseLobbyGame, mode: "training" } as GameState;
    const user = userEvent.setup();
    render(<GameBoard userId={null} />);

    const [nameInput] = screen.getAllByPlaceholderText("Pick A Rider Name");
    await user.clear(nameInput as HTMLElement);
    await user.type(nameInput as HTMLElement, "New Guest");

    const [joinGuestButton] = screen.getAllByRole("button", { name: "Join" });
    await user.click(joinGuestButton as HTMLElement);

    expect(sessionStorage.getItem("openspot-guest-name")).toBe("New Guest");
    expect(mockAction).toHaveBeenCalledWith("/join", {
      shareCode: "AUTO_SHARE_CODE_123",
    });
  });

  it("lets a guest join in one tap with a ready-made name", async () => {
    mockGameState = { ...baseLobbyGame, mode: "training" } as GameState;
    const user = userEvent.setup();
    render(<GameBoard userId={null} />);

    const [nameInput] = screen.getAllByPlaceholderText("Pick A Rider Name");
    expect((nameInput as HTMLInputElement).value).toMatch(/^Rider \d{4}$/);

    const [joinGuestButton] = screen.getAllByRole("button", { name: "Join" });
    await user.click(joinGuestButton as HTMLElement);

    expect(sessionStorage.getItem("openspot-guest-name")).toMatch(
      /^Rider \d{4}$/,
    );
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

  describe("result undo window", () => {
    const activeGame = {
      ...baseLobbyGame,
      mode: "training",
      status: "active",
      viewerPlayerId: "rider-1",
      currentChallengerPlayerId: "host-1",
      players: [
        ...baseLobbyGame.players,
        {
          id: "rider-1",
          userId: "rider-1",
          displayName: "Rider",
          letters: "",
          failedAttempts: 0,
          status: "active",
          seatOrder: 1,
        },
      ],
      currentRound: {
        id: "round-1",
        sequence: 1,
        status: "collecting_results",
        challengerPlayerId: "host-1",
        eligiblePlayerIds: ["host-1", "rider-1"],
        requiredResponsePlayerIds: ["rider-1"],
        trickName: "Kickflip",
        attempts: [],
        verifications: [],
      },
    } as unknown as GameState;

    let activeGameOverride: GameState | null = null;

    afterEach(() => {
      activeGameOverride = null;
    });

    async function tapResult(name: "Mark as landed" | "Mark as failed") {
      mockGameState = activeGameOverride ?? activeGame;
      render(<GameBoard userId="rider-1" />);
      const sheet = await screen.findByTestId("game-sheet");
      vi.useFakeTimers();
      fireEvent.click(within(sheet).getByRole("button", { name }));
      return sheet;
    }

    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    it("sends nothing until the window ends", async () => {
      mockAction.mockResolvedValue({ ok: true, data: { id: "game-123", version: 2 } });
      await tapResult("Mark as failed");

      await advance(3999);
      expect(mockAction).not.toHaveBeenCalled();

      await advance(1);
      expect(mockAction).toHaveBeenCalledOnce();
      expect(mockAction).toHaveBeenCalledWith(
        "/rounds/round-1/attempt",
        { result: "failed" },
        expect.objectContaining({ isSuperseded: expect.any(Function) }),
      );
    });

    it("uses the shorter window in solo", async () => {
      mockAction.mockResolvedValue({ ok: true, data: { id: "game-123", version: 2 } });
      activeGameOverride = {
        ...activeGame,
        trainingVariant: "solo",
        currentChallengerPlayerId: "rider-1",
        currentRound: {
          ...activeGame.currentRound,
          status: "challenge_open",
          challengerPlayerId: "rider-1",
        },
      } as unknown as GameState;
      await tapResult("Mark as landed");

      await advance(1999);
      expect(mockAction).not.toHaveBeenCalled();

      await advance(1);
      expect(mockAction).toHaveBeenCalledWith(
        "/rounds/round-1/challenger-result",
        { result: "landed" },
        expect.objectContaining({ isSuperseded: expect.any(Function) }),
      );
    });

    it("holds the desktop inline buttons for the same window", async () => {
      mockAction.mockResolvedValue({ ok: true, data: { id: "game-123", version: 2 } });
      mockGameState = {
        ...activeGame,
        stageLedger: [{ ...ledger[0], status: "collecting_results" }],
      } as unknown as GameState;
      render(<GameBoard userId="rider-1" />);
      await screen.findByTestId("game-sheet");
      const currentRow = screen.getByRole("listitem", { current: "step" });

      vi.useFakeTimers();
      fireEvent.click(within(currentRow).getByRole("button", { name: "Landed" }));
      await advance(0);

      expect(mockAction).not.toHaveBeenCalled();
      fireEvent.click(
        within(screen.getByRole("listitem", { current: "step" })).getByRole(
          "button",
          { name: "Undo landed" },
        ),
      );
      await advance(5000);

      expect(mockAction).not.toHaveBeenCalled();
    });

    it("never sends a result the rider undid", async () => {
      const sheet = await tapResult("Mark as failed");

      fireEvent.click(
        within(sheet).getByRole("button", { name: "Undo failed" }),
      );
      await advance(5000);

      expect(mockAction).not.toHaveBeenCalled();
      expect(
        within(sheet).getByRole("button", { name: "Mark as landed" }),
      ).toBeInTheDocument();
    });

    it("offers Send Again when no request got through", async () => {
      mockAction.mockResolvedValue({ ok: false, data: null });
      const sheet = await tapResult("Mark as landed");

      await advance(4000);

      expect(
        within(sheet).getByRole("button", { name: /No signal — result saved/ }),
      ).toBeInTheDocument();

      fireEvent.click(within(sheet).getByRole("button", { name: "Send Again" }));
      await advance(0);

      expect(mockAction).toHaveBeenCalledTimes(2);
    });

    it("does not offer Send Again after a server rejection", async () => {
      mockAction.mockResolvedValue({
        ok: false,
        data: { code: "DUPLICATE_ATTEMPT", error: "Already recorded." },
      });
      const sheet = await tapResult("Mark as landed");

      await advance(4000);

      expect(
        within(sheet).queryByRole("button", { name: "Send Again" }),
      ).not.toBeInTheDocument();
    });
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
