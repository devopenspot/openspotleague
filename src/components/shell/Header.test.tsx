import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Header } from "./Header";
import { useUIStore } from "@/stores/ui-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => null,
}));

vi.mock("@/hooks/data/useSavedSpots", () => ({
  useSavedSpots: () => ({ count: 0 }),
}));

vi.mock("@/components/shell/AppNavList", () => ({
  AppNavList: () => <nav data-testid="app-nav-list" />,
}));

vi.mock("@/components/shell/MobileDrawerTrigger", () => ({
  MobileDrawerTrigger: () => null,
}));

vi.mock("@/components/shell/NotificationBell", () => ({
  NotificationBell: () => null,
}));

vi.mock("@/components/shell/SignInLink", () => ({
  SignInLink: () => null,
}));

describe("Header", () => {
  beforeEach(() => {
    useUIStore.getState().setHeaderImage(null);
  });

  it("renders with default logo image when no parameter or store override is present", () => {
    const { container } = render(<Header />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain("/logo.png");
  });

  it("renders with custom image passed as parameter", () => {
    const { container } = render(
      <Header image="/custom-page-logo.png" imageAlt="Custom Brand" />,
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/custom-page-logo.png",
    );
    expect(img).toHaveAttribute("alt", "Custom Brand");
  });

  it("renders with custom image from ui-store when page sets it dynamically", () => {
    useUIStore.getState().setHeaderImage("/dynamic-event-logo.png");
    const { container } = render(<Header />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/dynamic-event-logo.png",
    );
  });

  it("prefers direct image prop over ui-store value", () => {
    useUIStore.getState().setHeaderImage("/store-image.png");
    const { container } = render(<Header image="/prop-image.png" />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/prop-image.png",
    );
  });
});
