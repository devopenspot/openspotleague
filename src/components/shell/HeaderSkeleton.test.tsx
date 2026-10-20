import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HeaderSkeleton } from "./HeaderSkeleton";
import { BottomNavSkeleton } from "./BottomNavSkeleton";

describe("HeaderSkeleton", () => {
  it("renders with dark primary background and wire border", () => {
    const { container } = render(<HeaderSkeleton />);
    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("bg-primary");
    expect(header).toHaveClass("border-wire-border");
    expect(header).toHaveAttribute("aria-hidden", "true");
  });

  it("renders pulsing placeholder pills matching the shell geometry", () => {
    const { container } = render(<HeaderSkeleton />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(7);
  });
});

describe("BottomNavSkeleton", () => {
  it("renders with dark primary background and wire border on mobile", () => {
    const { container } = render(<BottomNavSkeleton count={4} />);
    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("bg-primary");
    expect(nav).toHaveClass("border-wire-border");
    expect(nav).toHaveAttribute("aria-hidden", "true");
  });

  it("renders 4 tab item placeholders with pulse animation", () => {
    const { container } = render(<BottomNavSkeleton count={4} />);
    const pulses = container.querySelectorAll(".animate-pulse");
    // 4 icons + 4 labels = 8
    expect(pulses.length).toBe(8);
  });
});
