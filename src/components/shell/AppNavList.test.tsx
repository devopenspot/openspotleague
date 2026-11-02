import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/ui-store";
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
      screen.getByRole("link", { name: /Saved/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("3 spots saved")).toHaveClass(
      "rounded-md",
      "px-2",
      "py-1",
      "text-on-primary",
    );
    expect(screen.getByRole("link", { name: /Saved/ })).toHaveClass(
      "bg-primary",
      "text-on-primary",
      "border-primary",
    );
  });

  it("renders real links in a navigation landmark", () => {
    navigation.pathname = "/map";

    render(
      <AppNavList
        variant="mobile-tab"
        savedCount={0}
        onSelect={vi.fn()}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const link = screen.getByRole("link", { name: "Spots Map" });

    expect(nav).toHaveClass(
      "items-center",
      "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
    );
    expect(link).toHaveAttribute("href", "/map");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("text-on-wire");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("keeps every link reachable when no item is active", () => {
    navigation.pathname = "/login";

    render(
      <AppNavList
        variant="mobile-tab"
        savedCount={0}
        onSelect={vi.fn()}
      />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
      expect(link).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("only sets ids on the header variant, so the shared items never collide", () => {
    navigation.pathname = "/map";

    const { rerender } = render(
      <AppNavList variant="desktop" savedCount={0} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: "Spots Map" })).toHaveAttribute(
      "id",
      "nav-btn-map",
    );

    rerender(
      <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: "Spots Map" })).not.toHaveAttribute(
      "id",
    );
  });

  it("keeps Saved behind the onboarding gate instead of following the link", () => {
    navigation.pathname = "/map";
    const onSelect = vi.fn();
    const tryRun = vi.fn();
    useUIStore.setState({ tryRun });

    render(
      <AppNavList
        variant="mobile-drawer"
        savedCount={0}
        onSelect={onSelect}
      />,
    );

    const notPrevented = fireEvent.click(
      screen.getByRole("link", { name: /Saved/ }),
    );

    expect(notPrevented).toBe(false);
    expect(tryRun).toHaveBeenCalledWith(expect.any(Function), "/saved");
    expect(onSelect).not.toHaveBeenCalled();
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

    expect(screen.getByRole("link", { name: "Spots Map" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
