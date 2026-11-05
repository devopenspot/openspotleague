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
  it("renders the hero action pills without a league link", () => {
    render(<Hero />);

    expect(screen.getByRole("button", { name: "Nearby" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join with code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create new spot" }),
    ).toHaveAttribute("href", "/spots/new");
    expect(
      screen.queryByRole("link", { name: /league|events/i }),
    ).not.toBeInTheDocument();
  });
});
