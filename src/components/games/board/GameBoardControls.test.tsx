import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameBoardControls } from "@/components/games/board/GameBoardControls";
import type { GameCapabilities } from "@/lib/games/capabilities";
import type { GameState } from "@/lib/schemas/game";

const { copyTextMock, shareOrCopyUrlMock } = vi.hoisted(() => ({
  copyTextMock: vi.fn(),
  shareOrCopyUrlMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/games/game-1",
}));

vi.mock("@/lib/utils/share", () => ({
  copyText: copyTextMock,
  shareOrCopyUrl: shareOrCopyUrlMock,
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-code" data-value={value} />
  ),
}));

const game = {
  id: "game-1",
  version: 3,
  mode: "challenge",
  ruleMode: "strict",
  gameFormat: "tricks",
  status: "active",
  shareCode: "RIDE-123",
  gameName: "Play a Bike",
  eliminationWord: "BIKE",
  wordLength: 4,
  viewerIsHost: false,
  currentChallengerPlayerId: "leader",
  viewerPlayerId: "rider",
  viewerPoints: 0,
  spotId: "spot-12345678",
  scheduledStartAt: null,
  nextSpotType: "rails",
  nextLevel: 1,
  availableSpotTypes: [
    { slug: "rails", name: "Rails", sortOrder: 1 },
    { slug: "bowl", name: "Bowl", sortOrder: 2 },
  ],
  players: [
    { id: "leader", displayName: "Leader", letters: "", status: "active" },
    { id: "rider", displayName: "Rider", letters: "B", status: "active" },
  ],
  winnerPlayerId: null,
  stageLedger: [],
  currentRound: {
    id: "round-1",
    sequence: 2,
    status: "collecting_results",
    challengerPlayerId: "leader",
    spotType: "rails",
    trickName: "Backside 180",
    trickDescription: "A controlled rotation on the rails.",
    trickLevel: 1,
    verifications: [],
    attempts: [],
  },
} as unknown as GameState;

const noCapabilities: GameCapabilities = {
  canJoin: false,
  canLeave: false,
  canStart: false,
  canStartNow: false,
  canTrainAlone: false,
  canCancel: false,
  canVerifyLocation: false,
  canSelectSpotType: false,
  canSelectLevel: false,
  canSubmitChallenge: false,
  canSubmitResponse: false,
  canAdvanceToNextTrick: false,
};

const hostLobbyGame = {
  ...game,
  status: "lobby",
  viewerIsHost: true,
  currentRound: null,
} as unknown as GameState;

const scheduledHostLobbyGame = {
  ...hostLobbyGame,
  scheduledStartAt: "2030-01-01T12:05:00.000Z",
  currentRound: {
    id: "round-1",
    status: "verifying_location",
    verifications: [
      { playerId: "host", status: "verified" },
      { playerId: "rider", status: "verified" },
    ],
  },
} as unknown as GameState;

const sheet = () => screen.findByTestId("game-sheet");

beforeEach(() => {
  copyTextMock.mockReset();
  shareOrCopyUrlMock.mockReset();
});

describe("GameBoardControls", () => {
  it("shows the invite QR in the lobby without opening anything", async () => {
    render(
      <GameBoardControls
        game={
          {
            ...hostLobbyGame,
            players: [{ id: "rider", displayName: "Host", letters: "", status: "active" }],
          } as unknown as GameState
        }
        capabilities={{ ...noCapabilities, canTrainAlone: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      within(gameSheet).getByRole("img", { name: "QR code for shared link" }),
    ).toBeInTheDocument();
    expect(within(gameSheet).getByTestId("qr-code")).toHaveAttribute(
      "data-value",
      expect.stringContaining("/games/join/RIDE-123"),
    );
  });

  it("hides the QR once the lobby is full", async () => {
    render(
      <GameBoardControls
        game={hostLobbyGame}
        capabilities={{ ...noCapabilities, canStart: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      within(await sheet()).queryByRole("img", {
        name: "QR code for shared link",
      }),
    ).not.toBeInTheDocument();
  });

  it("shares the invite from the sheet", async () => {
    const user = userEvent.setup();
    shareOrCopyUrlMock.mockResolvedValue("copied");
    render(
      <GameBoardControls
        game={
          {
            ...hostLobbyGame,
            players: [{ id: "rider", displayName: "Host", letters: "", status: "active" }],
          } as unknown as GameState
        }
        capabilities={{ ...noCapabilities, canTrainAlone: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Share Link" }),
    );

    expect(shareOrCopyUrlMock).toHaveBeenCalledWith(
      expect.stringContaining("/games/join/RIDE-123"),
      "Play a Bike",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falls back to the invite drawer if sharing fails", async () => {
    const user = userEvent.setup();
    shareOrCopyUrlMock.mockResolvedValue("failed");
    render(
      <GameBoardControls
        game={
          {
            ...hostLobbyGame,
            players: [{ id: "rider", displayName: "Host", letters: "", status: "active" }],
          } as unknown as GameState
        }
        capabilities={{ ...noCapabilities, canTrainAlone: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Share Link" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Invite A Rider" }),
    ).toBeInTheDocument();
  });

  it("does not auto-open anything for a rider mid-game", async () => {
    render(<GameBoardControls game={game} onBackToChallenges={vi.fn()} />);

    await sheet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("carries the scheduled countdown in the sheet and lets the ready host start", async () => {
    const user = userEvent.setup();
    const onStartNow = vi.fn();
    render(
      <GameBoardControls
        game={scheduledHostLobbyGame}
        locationPermission="granted"
        capabilities={{ ...noCapabilities, canStartNow: true }}
        onStartNow={onStartNow}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      within(gameSheet).getByLabelText(/Session Starts In/),
    ).toBeInTheDocument();
    await user.click(
      within(gameSheet).getByRole("button", { name: "Drop In Now" }),
    );

    expect(onStartNow).toHaveBeenCalledOnce();
  });

  it("keeps the countdown dialog one tap away on desktop", async () => {
    const user = userEvent.setup();
    render(
      <GameBoardControls
        game={scheduledHostLobbyGame}
        capabilities={{ ...noCapabilities, canStartNow: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(screen.getByTestId("game-deck")).getByRole("button", {
        name: "Countdown",
      }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Play a Bike" }),
    ).toBeInTheDocument();
  });

  it("owns the sharing tools", async () => {
    const user = userEvent.setup();
    copyTextMock.mockResolvedValue(true);
    render(<GameBoardControls game={game} onBackToChallenges={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: "Open game controls" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Invite A Rider" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "QR code" }));

    const expectedShareUrl = new URL(
      `/games/join/${encodeURIComponent(game.shareCode)}`,
      window.location.origin,
    ).toString();
    expect(screen.getByTestId("qr-code")).toHaveAttribute(
      "data-value",
      expectedShareUrl,
    );

    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(copyTextMock).toHaveBeenCalledWith(expectedShareUrl);
  });

  it("opens challenge settings from the desktop deck", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <GameBoardControls
        game={game}
        canConfigureChallenge
        onOpenSettings={onOpenSettings}
        onBackToChallenges={vi.fn()}
      />,
    );

    const settingsButton = within(screen.getByTestId("game-deck")).getByRole(
      "button",
      { name: "Change Line" },
    );
    expect(settingsButton).toHaveAttribute(
      "aria-controls",
      "challenge-settings-drawer",
    );

    await user.click(settingsButton);

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("owns the completed match result and its navigation", async () => {
    const user = userEvent.setup();
    const onBackToChallenges = vi.fn();
    const completedGame = {
      ...game,
      status: "complete",
      winnerPlayerId: "rider",
      viewerPlayerId: "rider",
      players: [
        { id: "rider", displayName: "Rider", letters: "", status: "active" },
      ],
      currentRound: null,
    } as unknown as GameState;

    render(
      <GameBoardControls
        game={completedGame}
        onBackToChallenges={onBackToChallenges}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "You Won!" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run It Again" })).toHaveAttribute(
      "href",
      "/games",
    );

    const gameSheet = await sheet();
    await user.click(
      within(gameSheet).getByRole("button", { name: "Run It Again" }),
    );

    expect(onBackToChallenges).toHaveBeenCalledOnce();
  });

  it("shows the final non-winner and cancellation states", async () => {
    const otherWinnerGame = {
      ...game,
      status: "complete",
      winnerPlayerId: "leader",
      viewerPlayerId: "rider",
      currentRound: null,
    } as unknown as GameState;

    const { rerender } = render(
      <GameBoardControls game={otherWinnerGame} onBackToChallenges={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Session Complete" }),
    ).toBeInTheDocument();

    rerender(
      <GameBoardControls
        game={
          {
            ...otherWinnerGame,
            status: "cancelled",
            winnerPlayerId: null,
          } as unknown as GameState
        }
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Session Closed" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Run It Again" }),
    ).not.toBeInTheDocument();
  });

  it("keeps game context on screen", () => {
    render(<GameBoardControls game={game} onBackToChallenges={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Play a Bike" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Riders")).toBeInTheDocument();
    expect(screen.getByText("Leader Leads")).toBeInTheDocument();
    expect(screen.getByText("Leader: — · Rider: B")).toBeInTheDocument();
  });

  it("confirms before a participant finishes the session from the sheet", async () => {
    const user = userEvent.setup();
    const onCancelActive = vi.fn();
    render(
      <GameBoardControls
        game={game}
        capabilities={{ ...noCapabilities, canCancel: true }}
        onCancelActive={onCancelActive}
        onBackToChallenges={vi.fn()}
      />,
    );

    const finish = within(await sheet()).getByRole("button", {
      name: "Finish Challenge",
    });
    await user.click(finish);

    expect(
      screen.getByRole("alertdialog", { name: "Finish This Challenge?" }),
    ).toBeInTheDocument();
    expect(onCancelActive).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep Riding" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(onCancelActive).not.toHaveBeenCalled();

    await user.click(finish);
    await user.click(
      screen.getByRole("button", { name: "Yes, Finish Challenge" }),
    );

    expect(onCancelActive).toHaveBeenCalledOnce();
  });

  it("puts the challenger's result buttons in the sheet with no drawer", async () => {
    const user = userEvent.setup();
    const onChallengeResult = vi.fn();
    const challengeGame = {
      ...game,
      currentRound: { ...game.currentRound!, status: "challenge_open" },
    } as GameState;

    render(
      <GameBoardControls
        game={challengeGame}
        capabilities={{ ...noCapabilities, canSubmitChallenge: true }}
        onChallengeResult={onChallengeResult}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      within(gameSheet).getByRole("button", { name: /Your turn — set the line/ }),
    ).toBeInTheDocument();

    await user.click(
      within(gameSheet).getByRole("button", { name: "Mark as landed" }),
    );

    expect(onChallengeResult).toHaveBeenCalledWith("landed");
  });

  it("routes the responder's result to the attempt handler", async () => {
    const user = userEvent.setup();
    const onAttemptResult = vi.fn();

    render(
      <GameBoardControls
        game={game}
        capabilities={{ ...noCapabilities, canSubmitResponse: true }}
        onAttemptResult={onAttemptResult}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Mark as failed" }),
    );

    expect(onAttemptResult).toHaveBeenCalledWith("failed");
  });

  it("moves from waiting to the rider's turn in the same sheet", async () => {
    const waitingGame = {
      ...game,
      viewerPlayerId: "leader",
      currentRound: {
        ...game.currentRound!,
        requiredResponsePlayerIds: ["rider"],
        attempts: [{ playerId: "leader", result: "landed" }],
      },
    } as unknown as GameState;

    const { rerender } = render(
      <GameBoardControls
        game={waitingGame}
        capabilities={noCapabilities}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(
      within(gameSheet).getByRole("button", { name: /Waiting on Rider/ }),
    ).toBeInTheDocument();
    expect(within(gameSheet).getByText("Leader · landed")).toBeInTheDocument();
    expect(
      within(gameSheet).queryByRole("button", { name: "Mark as landed" }),
    ).not.toBeInTheDocument();

    rerender(
      <GameBoardControls
        game={game}
        capabilities={{ ...noCapabilities, canSubmitResponse: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      within(await sheet()).getByRole("button", { name: "Mark as landed" }),
    ).toBeInTheDocument();
  });

  it("limits trick skips and hides the control in strict rules", async () => {
    const user = userEvent.setup();
    const onNextTrick = vi.fn();
    const liveGame = {
      ...game,
      currentRound: { ...game.currentRound!, challengerPlayerId: "rider" },
    } as unknown as GameState;
    const capabilities = {
      ...noCapabilities,
      canAdvanceToNextTrick: true,
      canSubmitResponse: true,
    };

    const { rerender } = render(
      <GameBoardControls
        game={liveGame}
        capabilities={capabilities}
        alternativeTricksRemaining={3}
        onNextTrick={onNextTrick}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Skip Trick (3 Left)" }),
    );
    expect(onNextTrick).toHaveBeenCalledOnce();

    rerender(
      <GameBoardControls
        game={liveGame}
        capabilities={capabilities}
        alternativeTricksRemaining={0}
        onNextTrick={onNextTrick}
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      within(await sheet()).getByRole("button", { name: "No Skips Left" }),
    ).toBeDisabled();

    rerender(
      <GameBoardControls
        game={liveGame}
        capabilities={{ ...capabilities, canAdvanceToNextTrick: false }}
        alternativeTricksRemaining={3}
        onNextTrick={onNextTrick}
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      within(await sheet()).queryByRole("button", { name: /Skip Trick/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps location recovery and its notice together for a paused round", async () => {
    const onVerifyLocation = vi.fn();
    const user = userEvent.setup();
    const pausedGame = {
      ...game,
      currentRound: {
        ...game.currentRound!,
        status: "paused",
        verifications: [],
      },
    } as GameState;

    render(
      <GameBoardControls
        game={pausedGame}
        locationPermission="prompt"
        capabilities={{ ...noCapabilities, canVerifyLocation: true }}
        onVerifyLocation={onVerifyLocation}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(within(gameSheet).getByText(/Paused/)).toBeInTheDocument();
    await user.click(
      within(gameSheet).getByRole("button", { name: "Check In At Spot" }),
    );
    expect(onVerifyLocation).toHaveBeenCalledOnce();
  });

  it("joins a guest from the sheet footer", async () => {
    const user = userEvent.setup();
    const onGuestJoin = vi.fn();
    const lobbyGame = {
      ...game,
      status: "lobby",
      currentRound: null,
      currentChallengerPlayerId: null,
      viewerPlayerId: null,
      viewerIsHost: false,
    } as GameState;

    render(
      <GameBoardControls
        game={lobbyGame}
        authenticated={false}
        guestName="Rider"
        capabilities={{ ...noCapabilities, canJoin: true }}
        onGuestJoin={onGuestJoin}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(
      within(gameSheet).getByRole("textbox", { name: "Pick A Rider Name" }),
    ).toHaveValue("Rider");
    await user.click(within(gameSheet).getByRole("button", { name: "Join" }));

    expect(onGuestJoin).toHaveBeenCalledOnce();
  });

  it("joins a signed-in rider in one tap", async () => {
    const user = userEvent.setup();
    const onJoinLobby = vi.fn();
    render(
      <GameBoardControls
        game={
          { ...hostLobbyGame, viewerIsHost: false, viewerPlayerId: null } as GameState
        }
        capabilities={{ ...noCapabilities, canJoin: true }}
        onJoinLobby={onJoinLobby}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Join" }),
    );

    expect(onJoinLobby).toHaveBeenCalledOnce();
  });

  it("starts a solo run from the sheet", async () => {
    const user = userEvent.setup();
    const onTrainAlone = vi.fn();
    render(
      <GameBoardControls
        game={
          {
            ...hostLobbyGame,
            mode: "training",
            trainingVariant: "multiplayer",
            players: [{ id: "host", displayName: "Host", letters: "", status: "active" }],
          } as unknown as GameState
        }
        capabilities={{ ...noCapabilities, canTrainAlone: true }}
        onTrainAlone={onTrainAlone}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Ride Solo" }),
    );

    expect(onTrainAlone).toHaveBeenCalledOnce();
  });

  it("lets a non-leader vote on a category proposal", async () => {
    const user = userEvent.setup();
    const onCategoriesVote = vi.fn();
    render(
      <GameBoardControls
        game={
          {
            ...game,
            pendingCategoryProposal: {
              categories: ["flip"],
              proposerPlayerId: "leader",
              votes: [{ playerId: "rider", vote: "pending" }],
              createdAt: "2030-01-01T12:05:00.000Z",
            },
          } as unknown as GameState
        }
        onCategoriesVote={onCategoriesVote}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(
      within(await sheet()).getByRole("button", { name: "Accept" }),
    );

    expect(onCategoriesVote).toHaveBeenCalledWith(true);
  });

  it("surfaces an action error on the sheet handle and on desktop", async () => {
    render(
      <GameBoardControls
        game={game}
        error="You are too far from this spot."
        capabilities={{ ...noCapabilities, canSubmitResponse: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    const gameSheet = await sheet();
    expect(
      within(gameSheet).getByRole("button", {
        name: /You are too far from this spot/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("alert").map((element) => element.textContent),
    ).toContain("You are too far from this spot.");
  });
});
