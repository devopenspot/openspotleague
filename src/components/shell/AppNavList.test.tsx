import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNavList } from "./AppNavList";

const navigation = vi.hoisted(() => ({ pathname: "/saved" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => ({
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    initials: "TU",
    avatarUrl: null,
    canAccessAdmin: false,
    canCurate: false,
    isAdministrator: false,
  }),
}));

describe("AppNavList", () => {
  it("exposes drawer navigation semantics and renders the saved badge", () => {
    render(
      <AppNavList
        variant="mobile-drawer"
        savedCount={3}
        onSelect={vi.fn()}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Drawer primary navigation",
    });

    expect(navigation).toHaveClass("flex", "flex-col", "gap-2");
    expect(
      screen.getByRole("button", { name: /Saved/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("3 spots saved")).toHaveClass(
      "rounded-md",
      "px-2",
      "py-1",
      "text-on-primary",
    );
    expect(screen.getByRole("button", { name: /Saved/ })).toHaveClass(
      "bg-primary",
      "text-on-primary",
      "border-primary",
    );
  });

  it("keeps tab semantics and responsive container treatment", () => {
    navigation.pathname = "/explore";

    render(
      <AppNavList
        variant="mobile-tab"
        savedCount={0}
        onSelect={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Primary navigation" });

    expect(tablist).toHaveClass(
      "items-center",
      "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
    );
    expect(screen.getByRole("tab", { name: "Explore" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Explore" })).toHaveClass(
      "text-primary",
    );
  });

  it("does not mark Explore active on the landing page", () => {
    navigation.pathname = "/";

    render(
      <AppNavList
        variant="mobile-tab"
        savedCount={0}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Explore" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
