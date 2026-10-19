import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameCapabilities } from "@/lib/games/capabilities";
import type { GameState } from "@/lib/schemas/game";
import { Header } from "@/components/games/layout/Header";

const { copyTextMock } = vi.hoisted(() => ({
  copyTextMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/games/game-1",
}));

vi.mock("@/lib/utils/share", () => ({
  copyText: copyTextMock,
  shareOrCopyUrl: vi.fn(),
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
  viewerIsHost: false,
  currentChallengerPlayerId: "leader",
  viewerPlayerId: "rider",
  spotId: "spot-12345678",
  scheduledStartAt: null,
  nextSpotType: "rails",
  nextLevel: 1,
  availableSpotTypes: [
    { slug: "rails", name: "Rails", sortOrder: 1 },
    { slug: "bowl", name: "Bowl", sortOrder: 2 },
  ],
  players: [
    { id: "leader", displayName: "Leader", status: "active" },
    { id: "rider", displayName: "Rider", status: "active" },
  ],
  winnerPlayerId: null,
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
  lapCount: null,
  lapTimes: [],
  ghostMode: false,
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

const scheduledGuestLobbyGame = {
  ...scheduledHostLobbyGame,
  viewerIsHost: false,
  viewerPlayerId: null,
} as unknown as GameState;

const readyChallengeCapabilities: GameCapabilities = {
  ...noCapabilities,
  canStartNow: true,
};

const shareOnboardingStorageKey = "openspot:game-share-onboarding:v1:game-1";

beforeEach(() => {
  window.localStorage.clear();
  copyTextMock.mockReset();
});

describe("game Header", () => {
  it("opens invite onboarding for the host's first lobby visit", async () => {
    const user = userEvent.setup();
    render(<Header game={hostLobbyGame} onBackToChallenges={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", {
      name: "Invite Your Crew",
    });

    expect(
      within(dialog).getByRole("heading", { name: "Bring Your Crew" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Crew joins the lobby."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy code" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "QR code" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(shareOnboardingStorageKey)).toBe("seen");

    await user.click(
      within(dialog).getByRole("button", { name: "Continue To Session" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Invite Your Crew" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("does not reopen onboarding for a returning host", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(shareOnboardingStorageKey, "seen");
    render(<Header game={hostLobbyGame} onBackToChallenges={vi.fn()} />);

    expect(
      screen.queryByRole("dialog", { name: "Invite Your Crew" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open game controls" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Invite Your Crew" });
    expect(
      within(dialog).queryByRole("button", { name: "Continue To Session" }),
    ).not.toBeInTheDocument();
  });

  it("does not auto-open onboarding for a non-host", () => {
    render(<Header game={game} onBackToChallenges={vi.fn()} />);

    expect(
      screen.queryByRole("dialog", { name: "Invite Your Crew" }),
    ).not.toBeInTheDocument();
  });

  it("opens the challenge countdown and lets the ready host start early", async () => {
    const user = userEvent.setup();
    const onStartNow = vi.fn();
    render(
      <Header
        game={scheduledHostLobbyGame}
        capabilities={readyChallengeCapabilities}
        onStartNow={onStartNow}
        onBackToChallenges={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Play a Bike" });
    expect(within(dialog).getByText("Dropping In")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy code" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "QR code" }),
    ).toBeInTheDocument();
    const startNow = within(dialog).getByRole("button", {
      name: "Drop In Now",
    });
    expect(startNow).toBeEnabled();
    await user.click(startNow);

    expect(onStartNow).toHaveBeenCalledOnce();
  });

  it("shows guest join in the lobby dialog while keeping it on the board", async () => {
    const user = userEvent.setup();
    const onGuestJoin = vi.fn();
    render(
      <Header
        game={scheduledGuestLobbyGame}
        authenticated={false}
        guestName="Rider"
        capabilities={{ ...noCapabilities, canJoin: true }}
        onGuestJoin={onGuestJoin}
        onBackToChallenges={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Play a Bike" });
    expect(
      within(dialog).getByRole("textbox", { name: "Pick A Rider Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("textbox", { name: "Pick A Rider Name" }),
    ).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Join Crew" })).toHaveLength(
      2,
    );

    await user.click(within(dialog).getByRole("button", { name: "Join Crew" }));

    expect(onGuestJoin).toHaveBeenCalledOnce();
  });

  it("owns the branded controls drawer and sharing tools", async () => {
    const user = userEvent.setup();
    copyTextMock.mockResolvedValue(true);
    render(<Header game={game} onBackToChallenges={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: "Open game controls" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Invite Your Crew" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "QR code" }));

    expect(
      screen.getByLabelText("QR code for shared link"),
    ).toBeInTheDocument();
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

  it("opens challenge settings from the sticky action bar", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <Header
        game={game}
        canConfigureChallenge
        onOpenSettings={onOpenSettings}
        onBackToChallenges={vi.fn()}
      />,
    );

    const settingsButton = screen.getByRole("button", {
      name: "Switch It Up",
    });
    expect(settingsButton).toHaveAttribute(
      "aria-controls",
      "challenge-settings-drawer",
    );
    expect(settingsButton).toHaveAttribute("aria-expanded", "false");

    await user.click(settingsButton);

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("owns the completed match result and its navigation", async () => {
    const user = userEvent.setup();
    const onBackToChallenges = vi.fn();
    const completedGame = {
      ...game,
      status: "complete",
      winnerPlayerId: "game-1-rider",
      viewerPlayerId: "game-1-rider",
      players: [{ id: "game-1-rider", displayName: "Rider", status: "active" }],
      currentRound: null,
    } as unknown as GameState;

    render(
      <Header game={completedGame} onBackToChallenges={onBackToChallenges} />,
    );

    expect(
      screen.getByRole("heading", { name: "You Won!" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run It Again" })).toHaveAttribute(
      "href",
      "/games",
    );
    await user.click(screen.getByRole("button", { name: "Back To Spot" }));

    expect(onBackToChallenges).toHaveBeenCalledOnce();
  });

  it("shows the final non-winner and cancellation states in the header", () => {
    const otherWinnerGame = {
      ...game,
      status: "complete",
      winnerPlayerId: "leader",
      viewerPlayerId: "rider",
      players: [
        { id: "leader", displayName: "Leader", status: "active" },
        { id: "rider", displayName: "Rider", status: "eliminated" },
      ],
      currentRound: null,
    } as unknown as GameState;

    const { rerender } = render(
      <Header game={otherWinnerGame} onBackToChallenges={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Session Complete" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Leader Win — Check The Final Scores Below."),
    ).toBeInTheDocument();

    const cancelledGame = {
      ...otherWinnerGame,
      status: "cancelled",
      winnerPlayerId: null,
    } as unknown as GameState;

    rerender(<Header game={cancelledGame} onBackToChallenges={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Session Closed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This Session Was Closed.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Run It Again" }),
    ).not.toBeInTheDocument();
  });

  it("keeps game context in the sticky action bar", () => {
    render(<Header game={game} onBackToChallenges={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Play a Bike" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Riders")).toBeInTheDocument();
    expect(screen.getByText("Leader Leads")).toBeInTheDocument();
  });

  it("shows every participant the cancellation control and confirms before cancelling", async () => {
    const user = userEvent.setup();
    const onCancelActive = vi.fn();
    render(
      <Header
        game={game}
        capabilities={{ ...noCapabilities, canCancel: true }}
        onCancelActive={onCancelActive}
        onBackToChallenges={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Finish Challenge" }));

    expect(
      screen.getByRole("alertdialog", { name: "Finish This Challenge?" }),
    ).toBeInTheDocument();
    expect(onCancelActive).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep Riding" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(onCancelActive).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Finish Challenge" }));
    await user.click(
      screen.getByRole("button", { name: "Yes, Finish Challenge" }),
    );

    expect(onCancelActive).toHaveBeenCalledOnce();
  });

  it("renders the challenger action in the shared action zone", async () => {
    const user = userEvent.setup();
    const onChallengeResult = vi.fn();
    const challengeGame = {
      ...game,
      currentRound: { ...game.currentRound!, status: "challenge_open" },
    } as GameState;

    render(
      <Header
        game={challengeGame}
        capabilities={{ ...noCapabilities, canSubmitChallenge: true }}
        onChallengeResult={onChallengeResult}
        onBackToChallenges={vi.fn()}
      />,
    );

    // trigger pill opens drawer with trick details (auto-opens)
    const drawer = await screen.findByTestId("trick-action-drawer");
    expect(drawer).toBeInTheDocument();
    // drawer renders Landed/Failed arcade pads (aria-label Mark as landed)
    expect(
      screen.getByRole("button", { name: "Mark as landed" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark as landed" }));

    expect(onChallengeResult).toHaveBeenCalledWith("landed");
  });

  it("reopens the trick drawer when a round transitions from waiting to the responder's turn", async () => {
    const user = userEvent.setup();
    const waitingGame = {
      ...game,
      currentRound: {
        ...game.currentRound!,
        status: "challenge_open",
        challengerPlayerId: "leader",
        requiredResponsePlayerIds: ["rider"],
        attempts: [{ playerId: "leader", result: "landed" }],
      },
    } as unknown as GameState;

    const { rerender } = render(
      <Header
        game={waitingGame}
        capabilities={noCapabilities}
        onBackToChallenges={vi.fn()}
      />,
    );

    const drawer = await screen.findByTestId("trick-action-drawer");
    expect(within(drawer).getByText("Leader · landed")).toBeInTheDocument();

    await user.click(
      within(drawer).getByRole("button", { name: "Close trick panel" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("trick-action-drawer"),
      ).not.toBeInTheDocument(),
    );

    const responderTurnGame = {
      ...waitingGame,
      currentRound: {
        ...waitingGame.currentRound!,
        status: "collecting_results",
      },
    } as unknown as GameState;

    rerender(
      <Header
        game={responderTurnGame}
        capabilities={{ ...noCapabilities, canSubmitResponse: true }}
        onBackToChallenges={vi.fn()}
      />,
    );

    const reopened = await screen.findByTestId("trick-action-drawer");
    expect(
      within(reopened).getByRole("button", { name: "Mark as landed" }),
    ).toBeInTheDocument();
  });

  it("offers a limited alternative-trick retrieval without changing the action gate", async () => {
    const user = userEvent.setup();
    const onNextTrick = vi.fn();
    // need a live trick to prompt drawer
    const liveGame = {
      ...game,
      status: "active",
      currentRound: {
        ...game.currentRound!,
        status: "collecting_results",
        challengerPlayerId: "rider",
        requiredResponsePlayerIds: [],
        attempts: [],
      },
      trainingVariant: "multiplayer",
    } as unknown as GameState;
    const { rerender } = render(
      <Header
        game={liveGame}
        capabilities={{
          ...noCapabilities,
          canAdvanceToNextTrick: true,
          canSubmitResponse: true,
        }}
        alternativeTricksRemaining={3}
        onNextTrick={onNextTrick}
        onBackToChallenges={vi.fn()}
      />,
    );

    // open drawer via trigger
    await user.click(
      screen.getByRole("button", { name: "Open your turn panel" }),
    );
    const dialog = await screen.findByTestId("trick-action-drawer");
    await user.click(
      within(dialog).getByRole("button", { name: "Get next trick, 3 left" }),
    );
    expect(onNextTrick).toHaveBeenCalledOnce();

    rerender(
      <Header
        game={liveGame}
        capabilities={{
          ...noCapabilities,
          canAdvanceToNextTrick: true,
          canSubmitResponse: true,
        }}
        alternativeTricksRemaining={0}
        onNextTrick={onNextTrick}
        onBackToChallenges={vi.fn()}
      />,
    );

    // drawer still shows disabled next
    const dialog2 = await screen.findByTestId("trick-action-drawer");
    expect(
      within(dialog2).getByRole("button", { name: "No more next tricks" }),
    ).toBeDisabled();
  });

  it("keeps location recovery and its notice together for a paused round", async () => {
    const onVerifyLocation = vi.fn();
    const pausedGame = {
      ...game,
      currentRound: {
        ...game.currentRound!,
        status: "paused",
        verifications: [],
      },
    } as GameState;

    render(
      <Header
        game={pausedGame}
        locationPermission="prompt"
        capabilities={{ ...noCapabilities, canVerifyLocation: true }}
        onVerifyLocation={onVerifyLocation}
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Check In At Spot" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Paused/)).toBeInTheDocument();
  });

  it("uses one compact lobby flow for guest joining", async () => {
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
      <Header
        game={lobbyGame}
        authenticated={false}
        guestName="Rider"
        capabilities={{ ...noCapabilities, canJoin: true }}
        onGuestJoin={onGuestJoin}
        onBackToChallenges={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "Pick A Rider Name" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join Crew" }));

    expect(onGuestJoin).toHaveBeenCalledOnce();
  });

  it("suggests sharing training while keeping Train Alone available", async () => {
    const user = userEvent.setup();
    const onTrainAlone = vi.fn();
    const soloLobby = {
      ...hostLobbyGame,
      mode: "training",
      gameFormat: "tricks",
      trainingVariant: "multiplayer",
      players: [{ id: "host", displayName: "Host", status: "active" }],
    } as unknown as GameState;

    render(
      <Header
        game={soloLobby}
        capabilities={{ ...noCapabilities, canTrainAlone: true }}
        onTrainAlone={onTrainAlone}
        onBackToChallenges={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Invite Your Crew",
    });
    expect(
      within(dialog).getByRole("heading", {
        name: "Ride Solo Or Bring The Crew",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Ride Solo" });
    await user.click(button);

    expect(onTrainAlone).toHaveBeenCalledOnce();
  });
});
