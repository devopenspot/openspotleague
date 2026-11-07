import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameState } from "@/lib/schemas/game";

vi.mock("@/components/spots/weather/WeatherIcon", () => ({ WeatherIcon: () => null }));
vi.mock("@/components/ui/ShareActions", () => ({ ShareActions: () => null }));
vi.mock("@/components/feedback/Overlay", () => ({
  Overlay: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

import { ChallengeStartCountdownDialog } from "./ChallengeStartCountdownDialog";

const game = {
  id: "game-1",
  status: "lobby",
  mode: "challenge",
  gameName: "Play a Skate",
  shareCode: "ABC123",
  spotId: "spot-1",
  scheduledStartAt: new Date(Date.now() + 120_000).toISOString(),
  viewerIsHost: false,
  viewerPlayerId: "rider",
  weatherForecastIcon: null,
  players: [
    { id: "host", displayName: "Host", status: "active" },
    { id: "rider", displayName: "Rider", status: "active" },
  ],
  currentRound: { id: "round-1", status: "verifying_location", verifications: [] },
} as unknown as GameState;

const props = {
  game,
  isOpen: true,
  canStartNow: false,
  busy: false,
  authenticated: true,
  canJoin: false,
  guestName: "",
  guestJoinError: null,
  onGuestNameChange: vi.fn(),
  onGuestJoin: vi.fn(),
  onClose: vi.fn(),
  onStartNow: vi.fn(),
};

describe("ChallengeStartCountdownDialog", () => {
  it("lets a rider who isn't the host check in from the countdown", async () => {
    const onCheckIn = vi.fn();
    render(
      <ChallengeStartCountdownDialog
        {...props}
        checkIn={{ label: "Check In At Spot", pending: false, onCheckIn }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Check In At Spot" }));
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Waiting for the host to drop in")).toBeInTheDocument();
  });

  it("offers Join to a signed-in rider who can still join", async () => {
    const onJoin = vi.fn();
    render(<ChallengeStartCountdownDialog {...props} canJoin onJoin={onJoin} />);
    await userEvent.click(screen.getByRole("button", { name: "Join This Lobby" }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it("has one way to close", () => {
    render(<ChallengeStartCountdownDialog {...props} />);
    expect(screen.getByRole("button", { name: "Close countdown" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue To Lobby" })).toBeNull();
  });
});
