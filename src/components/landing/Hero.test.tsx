import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

vi.mock("@/components/shell/NearbyCtaButton", () => ({
  NearbyCtaButton: () => <button type="button">Nearby</button>,
}));

vi.mock("@/components/shell/JoinWithCode", () => ({
  JoinWithCode: () => <button type="button">Join with code</button>,
}));

describe("Hero", () => {
  it("renders action pill links including Events (/sport-events)", () => {
    render(<Hero />);

    const eventsLink = screen.getByRole("link", { name: /events/i });
    expect(eventsLink).toHaveAttribute("href", "/sport-events");

    const tvLink = screen.getByRole("link", { name: /^tv$/i });
    expect(tvLink).toHaveAttribute("href", "/tv");

    const gamesLink = screen.getByRole("link", {
      name: /training - challenges - league/i,
    });
    expect(gamesLink).toHaveAttribute("href", "/games");
  });
});
