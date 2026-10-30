import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Spot } from "@/lib/types";
import { useSpotsStore } from "@/stores/spots-store";
import { useMapStore } from "@/stores/map-store";
import { MapInfoPopup } from "./MapInfoPopup";

vi.mock("@/components/ui/AppImage", () => ({
  AppImage: (props: { src: string; alt: string }) => (
    <span data-testid="app-image" data-src={props.src} data-alt={props.alt} />
  ),
}));

vi.mock("@/components/map/hooks/use-map-actions", () => ({
  useMapActions: () => ({ clearActivePin: vi.fn() }),
}));

const mockWeatherSummary = vi.fn().mockReturnValue(null);

vi.mock("@/hooks/data/useSpotWeather", () => ({
  useSpotWeather: () => ({ weather: { icon: "sunny", current: 20 } }),
}));

vi.mock("@/hooks/data/useWeatherVerification", () => ({
  useWeatherVerification: () => ({
    summary: mockWeatherSummary(),
    loading: false,
    error: null,
    verifying: false,
    verify: vi.fn(),
    refresh: () => {},
  }),
}));

vi.mock(
  "@/components/spots/verification/SpotWeatherVerificationDialog",
  () => ({ SpotWeatherVerificationDialog: () => null }),
);

vi.mock("@/hooks/ui/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => undefined,
}));

const countryOnlySpot: Spot = {
  id: "co-2",
  slug: "parque-original-bogota",
  name: "Parque Original",
  city: "Bogota",
  citySlug: "bogota",
  address: "calle 1",
  types: [],
  sports: [],
  image: "co-2.jpg",
  country: "Colombia",
  countryCode: "CO",
  instagram: null,
  verificationCount: 3,
  visibility: "public",
  origin: "seed",
  communitySubmissionCount: 0,
  adminHidden: false,
  location: { lat: 4.6, lon: -74.06 },
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  useSpotsStore.setState({
    spots: [],
    regions: [],
    spotTypes: [],
    countrySpots: [],
    citySpots: [],
    nearbySpots: [],
  });
  useMapStore.setState({ activePinId: null, activeEventId: null });
});

describe("MapInfoPopup active spot resolution", () => {
  it("shows the dialog for a pin pointing at a country-only spot", () => {
    useSpotsStore.setState({ countrySpots: [countryOnlySpot] });
    useMapStore.setState({ activePinId: countryOnlySpot.id });

    render(<MapInfoPopup events={[]} />);

    expect(screen.getByRole("dialog", { hidden: false })).toBeTruthy();
    expect(screen.getByText(countryOnlySpot.name)).toBeTruthy();
  });

  it("shows the dialog for a pin pointing at a nearby-only spot", () => {
    const nearbyOnlySpot = { ...countryOnlySpot, id: "near-1", name: "Nearby Spot" };
    useSpotsStore.setState({ nearbySpots: [nearbyOnlySpot] });
    useMapStore.setState({ activePinId: nearbyOnlySpot.id });

    render(<MapInfoPopup events={[]} />);

    expect(screen.getByRole("dialog", { hidden: false })).toBeTruthy();
    expect(screen.getByText("Nearby Spot")).toBeTruthy();
  });

  it("still resolves base-directory pins without the country list", () => {
    useSpotsStore.setState({ spots: [countryOnlySpot] });
    useMapStore.setState({ activePinId: countryOnlySpot.id });

    render(<MapInfoPopup events={[]} />);

    expect(screen.getByRole("dialog", { hidden: false })).toBeTruthy();
    expect(screen.getByText(countryOnlySpot.name)).toBeTruthy();
  });

  it("prefers the base directory before falling back to the country list", () => {
    const baseSpot = { ...countryOnlySpot, id: "base-1", name: "Base Spot" };
    useSpotsStore.setState({ spots: [baseSpot], countrySpots: [countryOnlySpot] });
    useMapStore.setState({ activePinId: baseSpot.id });

    render(<MapInfoPopup events={[]} />);

    expect(screen.getByText("Base Spot")).toBeTruthy();
  });

  it("renders nothing when the pin does not resolve in either source", () => {
    useMapStore.setState({ activePinId: "missing-id" });

    render(<MapInfoPopup events={[]} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to the static map without magnifying lens and with +10% lighter map theme for a spot without an image", () => {
    const imagelessSpot = {
      ...countryOnlySpot,
      id: "img-less",
      name: "Imageless Spot",
      image: "",
    };
    useSpotsStore.setState({ spots: [imagelessSpot] });
    useMapStore.setState({ activePinId: imagelessSpot.id });

    const { container } = render(<MapInfoPopup events={[]} />);

    expect(screen.getByRole("dialog", { hidden: false })).toBeTruthy();
    expect(screen.getByText("© OpenStreetMap")).toBeTruthy();
    expect(container.querySelector(".map-theme-lighter")).toBeTruthy();
    expect(container.querySelector(".ring-map-outline\\/60")).toBeNull();
    expect(container.querySelectorAll("img.map-tile-dark").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("app-image")).toBeNull();
  });

  it("renders weather verify button with dual tiny icons when active", () => {
    mockWeatherSummary.mockReturnValue({
      active: true,
      leader: "rain",
      count: 4,
      expiresAt: "2026-01-01T02:00:00.000Z",
      totalActive: 4,
    });
    useSpotsStore.setState({ spots: [countryOnlySpot] });
    useMapStore.setState({ activePinId: countryOnlySpot.id });

    render(<MapInfoPopup events={[]} />);

    expect(screen.getByRole("button", { name: /confirm on-site weather/i })).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    mockWeatherSummary.mockReturnValue(null);
  });
});
