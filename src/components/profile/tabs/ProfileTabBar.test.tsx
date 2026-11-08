import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfileTabBar } from "./ProfileTabBar";
import { parseProfileTab, profileTabSearch, type TabId } from "./profile-tabs";

describe("parseProfileTab", () => {
  it("reads known ids and falls back to overview", () => {
    expect(parseProfileTab("spots")).toBe("spots");
    expect(parseProfileTab(" Tricks ")).toBe("tricks");
    expect(parseProfileTab(["account", "games"])).toBe("account");
    expect(parseProfileTab(undefined)).toBe("overview");
    expect(parseProfileTab("nope")).toBe("overview");
  });

  it("maps the old play and settings ids", () => {
    expect(parseProfileTab("play")).toBe("games");
    expect(parseProfileTab("settings")).toBe("account");
  });

  it("keeps the default tab out of the URL", () => {
    expect(profileTabSearch("overview")).toBe("");
    expect(profileTabSearch("spots")).toBe("?tab=spots");
  });
});

function Harness({ initial = "overview" }: { initial?: TabId }) {
  const [active, setActive] = useState<TabId>(initial);
  return <ProfileTabBar active={active} onChange={setActive} />;
}

describe("ProfileTabBar", () => {
  it("is a single tab stop", () => {
    render(<Harness initial="spots" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Spots" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves and activates with arrow keys, wrapping at the ends, and Home/End", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Overview" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Games" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Games" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Account" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
  });
});
