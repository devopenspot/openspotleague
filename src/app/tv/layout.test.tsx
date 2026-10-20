import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "@/stores/ui-store";
import TvLayout from "./layout";

describe("TvLayout", () => {
  beforeEach(() => {
    useUIStore.getState().setHeaderImage(null);
  });

  it("sets the TV header image parameter to /osl-tv.png while mounted and resets on unmount", () => {
    const { unmount } = render(
      <TvLayout>
        <div data-testid="tv-child">TV Content</div>
      </TvLayout>,
    );

    expect(screen.getByTestId("tv-child")).toBeInTheDocument();
    expect(useUIStore.getState().headerImage).toBe("/osl-tv.png");

    unmount();
    expect(useUIStore.getState().headerImage).toBeNull();
  });
});
