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
  Header: ({ image }: { image?: string }) => (
    <header data-testid="app-header" data-image={image ?? "default"}>
      Header
    </header>
  ),
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

  it("renders Header and BottomNav on the landing page", () => {
    mockPathname = "/";
    render(
      <AppShell>
        <div>Landing Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
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
      "Open Spot games",
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

  it("lets the shell grow with a document-scrolling page so content clears the bottom nav", () => {
    mockPathname = "/login";
    const { container } = render(
      <AppShell>
        <div>Login Content</div>
      </AppShell>,
    );

    const root = container.querySelector("#app-root");
    expect(root).toHaveClass("min-h-dvh");
    expect(root).not.toHaveClass("h-dvh");
  });

  it.each(["/map", "/games", "/games/abc-123", "/"])(
    "keeps a one-screen shell on %s, which scrolls inside main",
    (pathname) => {
      mockPathname = pathname;
      const { container } = render(
        <AppShell>
          <div>Framed Content</div>
        </AppShell>,
      );

      const root = container.querySelector("#app-root");
      expect(root).toHaveClass("h-dvh");
      expect(root).not.toHaveClass("min-h-dvh");
    },
  );

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

  it("forwards headerImage to Header component", () => {
    render(
      <AppShell headerImage="/custom-shell-logo.png">
        <div>Custom Logo Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("app-header")).toHaveAttribute(
      "data-image",
      "/custom-shell-logo.png",
    );
  });
});
