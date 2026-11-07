import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/spots/weather/WeatherIcon", () => ({
  WeatherIcon: () => null,
}));

import { ChallengeSpotStep, TrainingPlaceStep } from "./form-parts";
import type { Spot } from "@/lib/types";

const baseProps = {
  selectedSpot: null,
  selectedDistanceMeters: null,
  distanceUnit: "km" as const,
  locationStatus: "granted" as const,
  locationLoading: false,
  spotAccepted: null,
  onSpotAcceptance: vi.fn(),
  onRetryLocation: vi.fn(),
};

describe("ChallengeSpotStep with no spot nearby", () => {
  it("offers quick-add and Play as Training for a battle", async () => {
    const onContinueTraining = vi.fn();
    render(
      <ChallengeSpotStep
        {...baseProps}
        onContinueTraining={onContinueTraining}
        quickAdd={<p>quick add form</p>}
      />,
    );
    expect(screen.getByText("quick add form")).toBeInTheDocument();
    expect(screen.getByText(/earn leaderboard\s+points/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Play as Training" }));
    expect(onContinueTraining).toHaveBeenCalledTimes(1);
  });

  it("does not push training riders to switch modes", () => {
    render(
      <ChallengeSpotStep
        {...baseProps}
        context="training"
        onContinueTraining={vi.fn()}
        quickAdd={<p>quick add form</p>}
      />,
    );
    expect(screen.getByText("quick add form")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play as Training" })).toBeNull();
  });

  it("explains that a personal battle spot unlocks points after check-in", () => {
    const spot = {
      id: "spot-1",
      name: "New Ledge",
      city: "Madrid",
      visibility: "personal",
    } as unknown as Spot;
    render(
      <ChallengeSpotStep
        {...baseProps}
        selectedSpot={spot}
        onContinueTraining={vi.fn()}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(/opponent checks in/);
  });
});

describe("ChallengeSpotStep after rejecting the only spot", () => {
  const spot = { id: "spot-1", name: "Old Ledge", city: "Madrid", visibility: "public" } as unknown as Spot;

  it("keeps a way forward in a battle: quick-add and Play as Training", () => {
    render(
      <ChallengeSpotStep
        {...baseProps}
        selectedSpot={spot}
        spotAccepted={false}
        onContinueTraining={vi.fn()}
        quickAdd={<p>quick add form</p>}
      />,
    );
    expect(screen.getByText("quick add form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play as Training" })).toBeInTheDocument();
    expect(screen.queryByText(/stays locked/)).toBeNull();
  });

  it("hides Retry location once the spot is accepted", () => {
    render(
      <ChallengeSpotStep
        {...baseProps}
        selectedSpot={spot}
        spotAccepted
        onContinueTraining={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Retry location" })).toBeNull();
  });
});

describe("ChallengeSpotStep copy in training", () => {
  it("never tells a training rider to continue with Training", () => {
    for (const locationStatus of ["denied", "unavailable", "granted", "idle"] as const) {
      const { container, unmount } = render(
        <ChallengeSpotStep
          {...baseProps}
          context="training"
          locationStatus={locationStatus}
          onContinueTraining={vi.fn()}
        />,
      );
      expect(container.textContent).not.toMatch(/continue with Training|Challenge needs/i);
      unmount();
    }
  });
});

describe("TrainingPlaceStep", () => {
  it("shows the place name field only for Just a name", async () => {
    const onPlaceChange = vi.fn();
    const { rerender } = render(
      <TrainingPlaceStep
        place="none"
        spotLabel=""
        onPlaceChange={onPlaceChange}
        onSpotLabelChange={vi.fn()}
      >
        <p>spot finder</p>
      </TrainingPlaceStep>,
    );
    expect(screen.queryByLabelText("Place name")).toBeNull();
    expect(screen.queryByText("spot finder")).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Just a name" }));
    expect(onPlaceChange).toHaveBeenCalledWith("label");

    rerender(
      <TrainingPlaceStep
        place="label"
        spotLabel=""
        onPlaceChange={onPlaceChange}
        onSpotLabelChange={vi.fn()}
      >
        <p>spot finder</p>
      </TrainingPlaceStep>,
    );
    expect(screen.getByLabelText("Place name")).toBeInTheDocument();

    rerender(
      <TrainingPlaceStep
        place="spot"
        spotLabel=""
        onPlaceChange={onPlaceChange}
        onSpotLabelChange={vi.fn()}
      >
        <p>spot finder</p>
      </TrainingPlaceStep>,
    );
    expect(screen.getByText("spot finder")).toBeInTheDocument();
  });
});
