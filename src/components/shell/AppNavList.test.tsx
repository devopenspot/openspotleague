import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/ui-store";
import { useSpotsStore } from "@/stores/spots-store";
import { clearLastMapFilter, setLastMapFilter } from "@/lib/map/last-filter";
import type { Region } from "@/lib/types";
import { AppNavList } from "./AppNavList";

const navigation = vi.hoisted(() => ({ pathname: "/saved" }));
const router = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }));
const preload = vi.hoisted(() => ({ preloadMapCanvas: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => router,
}));

vi.mock("@/lib/map/preload", () => preload);

// Header/drawer say "Spots Map", the bottom bar says "Map".
const MAP_LINK = /^(Spots )?Map$/;

const regions: Region[] = [
  {
    name: "Europe",
    desc: "Europe spots",
    count: "1.0k Spots",
    image: "",
    link: "/map?region=europe",
    countries: ["France"],
  },
];

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
      "rounded-control",
      "bg-on-wire",
      "text-wire",
    );
    expect(screen.getByRole("link", { name: /Saved/ })).toHaveClass(
      "rounded-control",
      "bg-on-wire",
      "text-wire",
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
    const link = screen.getByRole("link", { name: MAP_LINK });

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
    expect(screen.getByRole("link", { name: MAP_LINK })).toHaveAttribute(
      "id",
      "nav-btn-map",
    );

    rerender(
      <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: MAP_LINK })).not.toHaveAttribute(
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

    expect(screen.getByRole("link", { name: MAP_LINK })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("exposes League (/league) across desktop, mobile-tab, and mobile-drawer variants", () => {
    navigation.pathname = "/league/night-jam";

    const { rerender } = render(
      <AppNavList variant="desktop" savedCount={0} onSelect={vi.fn()} />,
    );
    const desktopLink = screen.getByRole("link", { name: "League" });
    expect(desktopLink).toHaveAttribute("href", "/league");
    expect(desktopLink).toHaveAttribute("id", "nav-btn-league");
    expect(desktopLink).toHaveAttribute("aria-current", "page");

    rerender(
      <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
    );
    const mobileTabLink = screen.getByRole("link", { name: "League" });
    expect(mobileTabLink).toHaveAttribute("href", "/league");
    expect(mobileTabLink).toHaveAttribute("aria-current", "page");

    rerender(
      <AppNavList variant="mobile-drawer" savedCount={0} onSelect={vi.fn()} />,
    );
    const drawerLink = screen.getByRole("link", { name: "League" });
    expect(drawerLink).toHaveAttribute("href", "/league");
    expect(drawerLink).toHaveAttribute("aria-current", "page");
  });

  describe("map entry", () => {
    beforeEach(() => {
      navigation.pathname = "/league";
      router.push.mockClear();
      router.prefetch.mockClear();
      preload.preloadMapCanvas.mockClear();
      useSpotsStore.setState({ regions });
    });

    afterEach(() => {
      clearLastMapFilter();
      useSpotsStore.setState({ regions: [] });
    });

    it("navigates straight to the stored filter on a plain click", () => {
      setLastMapFilter("Europe", "France", "paris");
      render(
        <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
      );
      const link = screen.getByRole("link", { name: MAP_LINK });

      expect(link).toHaveAttribute("href", "/map");
      const notPrevented = fireEvent.click(link);

      expect(notPrevented).toBe(false);
      expect(router.push).toHaveBeenCalledWith(
        "/map?region=europe&country=france&city=paris",
      );
    });

    it("keeps native link behaviour for modified clicks", () => {
      setLastMapFilter("Europe", "France", "paris");
      render(
        <AppNavList variant="desktop" savedCount={0} onSelect={vi.fn()} />,
      );
      const notPrevented = fireEvent.click(
        screen.getByRole("link", { name: MAP_LINK }),
        { metaKey: true },
      );

      expect(notPrevented).toBe(true);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("follows the plain /map link when nothing is stored", () => {
      render(
        <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("link", { name: MAP_LINK }));

      expect(router.push).not.toHaveBeenCalled();
    });

    it("warms the map on intent only", () => {
      setLastMapFilter("Europe", "France", "paris");
      render(
        <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
      );
      expect(preload.preloadMapCanvas).not.toHaveBeenCalled();
      expect(router.prefetch).not.toHaveBeenCalled();

      fireEvent.touchStart(screen.getByRole("link", { name: MAP_LINK }));

      expect(preload.preloadMapCanvas).toHaveBeenCalledTimes(1);
      expect(router.prefetch).toHaveBeenCalledWith(
        "/map?region=europe&country=france&city=paris",
      );
    });

    it("leaves the Map link alone while already on the map", () => {
      navigation.pathname = "/map";
      setLastMapFilter("Europe", "France", "paris");
      render(
        <AppNavList variant="mobile-tab" savedCount={0} onSelect={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("link", { name: MAP_LINK }));

      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
