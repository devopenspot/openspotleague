import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/shell/Header", () => ({
  Header: () => <header data-testid="app-header">Header</header>,
}));

vi.mock("@/components/shell/BottomNav", () => ({
  BottomNav: () => <nav data-testid="bottom-nav">BottomNav</nav>,
}));

vi.mock("@/components/shell/MobileDrawer", () => ({
  MobileDrawer: () => null,
}));

vi.mock("@/components/shell/SearchOverlay", () => ({
  SearchOverlay: () => null,
}));

vi.mock("@/components/shell/OnboardingDialog", () => ({
  OnboardingDialog: () => null,
}));

vi.mock("@/components/shell/Toast", () => ({
  ToastViewport: () => null,
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("renders Header on the landing page without BottomNav", () => {
    mockPathname = "/";
    render(
      <AppShell>
        <div>Landing Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument();
    expect(screen.getByText("Landing Content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-label",
      "Open Spot content",
    );
  });

  it("renders both Header and BottomNav on /map with map aria-label", () => {
    mockPathname = "/map";
    render(
      <AppShell>
        <div>Map Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-label",
      "Spot map",
    );
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
  });

  it("renders Header and BottomNav on /games (League tab)", () => {
    mockPathname = "/games";
    render(
      <AppShell>
        <div>League Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-label",
      "Open Spot challenges",
    );
  });

  it("hides Header and BottomNav on active game session /games/:id", () => {
    mockPathname = "/games/abc-123";
    render(
      <AppShell>
        <div>Game Board Viewport</div>
      </AppShell>,
    );

    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument();
    expect(screen.getByText("Game Board Viewport")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
  });

  it("bails out completely on /admin routes", () => {
    mockPathname = "/admin/spots";
    const { container } = render(
      <AppShell>
        <div data-testid="admin-content">Admin Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
    expect(screen.queryByTestId("app-header")).not.toBeInTheDocument();
    expect(container.querySelector("#app-root")).not.toBeInTheDocument();
  });
});
