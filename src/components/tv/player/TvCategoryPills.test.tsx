import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TvCategoryPills } from "./TvCategoryPills";

describe("TvCategoryPills", () => {
  const options = [
    { category: "music" as const, count: 25 },
    { category: "profile" as const, count: 12 },
  ];

  it("renders All and category options without counts in aria-label", () => {
    const onSelect = vi.fn();
    render(
      <TvCategoryPills
        options={options}
        selected="all"
        onSelect={onSelect}
      />,
    );

    const allBtn = screen.getByRole("button", { name: "All categories" });
    expect(allBtn).toBeDefined();
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");

    const musicBtn = screen.getByRole("button", { name: "Music" });
    expect(musicBtn).toBeDefined();
    expect(musicBtn.getAttribute("aria-pressed")).toBe("false");

    const profileBtn = screen.getByRole("button", { name: "Profile" });
    expect(profileBtn).toBeDefined();
    expect(profileBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onSelect with the selected category on click", async () => {
    const onSelect = vi.fn();
    render(
      <TvCategoryPills
        options={options}
        selected="all"
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Music" }));
    expect(onSelect).toHaveBeenCalledWith("music");
  });

  it("calls onSelect with 'all' when All pill is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <TvCategoryPills
        options={options}
        selected="music"
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "All categories" }));
    expect(onSelect).toHaveBeenCalledWith("all");
  });

  it("disables all pills when disabled prop is true", () => {
    render(
      <TvCategoryPills
        options={options}
        selected="all"
        onSelect={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "All categories" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Music" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Profile" })).toBeDisabled();
  });
});
