import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TvLayout from "./layout";

describe("TvLayout", () => {
  it("renders children in a full-height dark container", () => {
    const { container } = render(
      <TvLayout>
        <div data-testid="tv-child">TV Content</div>
      </TvLayout>,
    );

    expect(screen.getByTestId("tv-child")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("min-h-dvh", "bg-wire", "text-white");
  });
});
