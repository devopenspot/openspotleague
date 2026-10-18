import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TvAutoplayerButton } from "./TvAutoplayerButton";

describe("TvAutoplayerButton", () => {
  it("renders honest video count and discipline label", () => {
    render(
      <TvAutoplayerButton
        count={24}
        disciplineLabel="All sports"
        onOpen={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", {
      name: /Autoplay All sports — 24 videos/i,
    });
    expect(button).toBeDefined();
    expect(button.getAttribute("disabled")).toBeNull();
    expect(screen.getByText(/All sports · 24/)).toBeDefined();
  });

  it("includes category label when provided", () => {
    render(
      <TvAutoplayerButton
        count={8}
        disciplineLabel="BMX"
        categoryLabel="Music"
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /Autoplay BMX · Music — 8 videos/i,
      }),
    ).toBeDefined();
    expect(screen.getByText(/BMX · Music · 8/)).toBeDefined();
  });

  it("treats category label 'All' as all categories without redundancy", () => {
    render(
      <TvAutoplayerButton
        count={8}
        disciplineLabel="All sports"
        categoryLabel="All"
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /Autoplay All sports — 8 videos/i,
      }),
    ).toBeDefined();
    expect(screen.getByText(/All sports · 8/)).toBeDefined();
  });

  it("calls onOpen when clicked by user", async () => {
    const onOpen = vi.fn();
    render(
      <TvAutoplayerButton
        count={10}
        disciplineLabel="Skateboard"
        onOpen={onOpen}
      />,
    );

    const button = screen.getByRole("button", {
      name: /Autoplay Skateboard — 10 videos/i,
    });
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("is disabled with clear reason when count is zero", () => {
    render(
      <TvAutoplayerButton
        count={0}
        disciplineLabel="Roller"
        onOpen={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", {
      name: /Autoplay unavailable — No videos for this filter/i,
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("honors explicit disabled prop", () => {
    render(
      <TvAutoplayerButton
        count={5}
        disciplineLabel="BMX"
        disabled
        onOpen={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
