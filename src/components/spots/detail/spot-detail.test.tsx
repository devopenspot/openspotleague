import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpotDetailsHero } from "./SpotDetailsHero";
import { SpotDetailsWeather } from "./SpotDetailsWeather";
import { SpotDetailsActions } from "./SpotDetailsActions";
import { SpotDetailsLocation } from "./SpotDetailsLocation";
import type { Spot } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default: () => function MockDynamic() {
    return <div data-testid="mock-static-map" />;
  },
}));

vi.mock("@/components/ui/AppImage", () => ({
  AppImage: ({ alt, className }: { alt: string; className: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} />
  ),
}));

const mockSpot: Spot = {
  id: "test-spot-1",
  name: "Largo do Intendente spot",
  slug: "largo-do-intendente",
  address: "Largo do Intendente Pina Manique, Lisboa",
  city: "Lisboa",
  citySlug: "lisboa",
  country: "Portugal",
  countryCode: "PT",
  location: { lat: 38.72, lon: -9.13 },
  image: "https://example.com/spot.jpg",
  types: [{ name: "Skatepark", slug: "skatepark" }],
  sports: ["Skateboard", "BMX"],
  verificationCount: 3,
  instagram: null,
  visibility: "public",
  origin: "community",
  communitySubmissionCount: 0,
  adminHidden: false,
  createdBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SpotDetailsHero", () => {
  it("renders 44px min-height verify weather button with uppercase text", () => {
    const onVerifyClick = vi.fn();
    render(
      <SpotDetailsHero
        spot={mockSpot}
        distanceInfo={{ kind: "distance", label: "2.4 KM" }}
        isRequestingLocation={false}
        onRequestLocation={vi.fn()}
        onVerifyClick={onVerifyClick}
      />,
    );

    const btn = screen.getByRole("button", { name: "Verify weather" });
    expect(btn.className).toContain("min-h-11");
    expect(btn.className).toContain("uppercase");
    expect(btn.className).toContain("text-surface");
    expect(btn.className).not.toContain("text-on-surface");
    expect(btn.className).not.toContain("capitalize");

    fireEvent.click(btn);
    expect(onVerifyClick).toHaveBeenCalledTimes(1);
  });

  it("renders weather verified badge when summary is active and remains clickable for other users", () => {
    const onVerifyClick = vi.fn();
    render(
      <SpotDetailsHero
        spot={mockSpot}
        distanceInfo={{ kind: "distance", label: "2.4 KM" }}
        isRequestingLocation={false}
        onRequestLocation={vi.fn()}
        weatherSummary={{
          active: true,
          leader: "cloudy",
          count: 5,
          expiresAt: "2026-01-01T02:00:00.000Z",
          totalActive: 5,
        }}
        weatherIcon="rain"
        onVerifyClick={onVerifyClick}
      />,
    );

    expect(screen.getByText("Weather verified")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();

    const btn = screen.getByRole("button", { name: /verify weather/i });
    expect(btn.className).toContain("min-h-11");
    fireEvent.click(btn);
    expect(onVerifyClick).toHaveBeenCalledTimes(1);
  });
});

describe("SpotDetailsWeather", () => {
  it("renders flush negative margins matching parent padding and clean weather data", () => {
    const { container } = render(
      <SpotDetailsWeather
        spot={mockSpot}
        weather={{
          icon: "sunny",
          current: 18,
          description: "clear sky",
          wind: 5.5,
          humidity: 45,
        }}
        temperatureUnit="C"
      />,
    );

    const section = container.querySelector("section");
    expect(section?.className).toContain("-mx-5");
    expect(section?.className).toContain("md:-mx-8");
    expect(section?.className).not.toContain("-mx-6");

    expect(screen.getByText("18°C")).toBeTruthy();
    expect(screen.getByText("clear sky")).toBeTruthy();
    expect(screen.getByText("20 km/h")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();

    const liveLink = screen.getByRole("link", { name: /zoom\.earth/i });
    expect(liveLink.getAttribute("target")).toBe("_blank");
    expect(liveLink.getAttribute("rel")).toContain("noopener");
  });

  it("renders verified community badge with dual icons when weatherSummary is active", () => {
    render(
      <SpotDetailsWeather
        spot={mockSpot}
        weather={{
          icon: "rain",
          current: 18,
          description: "light rain",
          wind: 5.5,
          humidity: 45,
        }}
        temperatureUnit="C"
        weatherSummary={{
          active: true,
          leader: "cloudy",
          count: 3,
          expiresAt: "2026-01-01T02:00:00.000Z",
          totalActive: 3,
        }}
      />,
    );

    expect(screen.getByTestId("weather-status-community-badge")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});

describe("SpotDetailsActions", () => {
  it("renders 44px min-height action buttons with proper state and fills", () => {
    const onToggleVerify = vi.fn();
    const onToggleSave = vi.fn();
    render(
      <SpotDetailsActions
        spot={mockSpot}
        isSaved={true}
        isVerified={true}
        onToggleSave={onToggleSave}
        onToggleVerify={onToggleVerify}
        burstKey={0}
        locationStatus="granted"
        onRequestLocation={vi.fn()}
      />,
    );

    const verifyBtn = screen.getByRole("button", { name: /remove your verification/i });
    expect(verifyBtn.className).toContain("min-h-11");
    expect(verifyBtn.className).toContain("bg-primary");
    expect(screen.getByText("Verified")).toBeTruthy();

    const saveBtn = screen.getByRole("button", { name: /unsave/i });
    expect(saveBtn.className).toContain("min-h-11");
    expect(saveBtn.className).toContain("bg-primary");
    expect(screen.getByText("Saved")).toBeTruthy();

    const shareBtn = screen.getByRole("button", { name: /share/i });
    expect(shareBtn.className).toContain("min-h-11");
    expect(screen.getByText("Share")).toBeTruthy();
  });
});

describe("SpotDetailsLocation", () => {
  it("renders primary CTA, secondary map button, and 2-column external directions grid", () => {
    const { container } = render(
      <SpotDetailsLocation
        spot={mockSpot}
        gamePrefillHref="/games?spotId=test-spot-1"
        viewOnMapUrl="/map?spot=test-spot-1"
        directionsUrl="https://maps.google.com"
        wazeUrl="https://waze.com"
      />,
    );

    // Primary CTA is solid black bg-primary
    const trainLink = screen.getByRole("link", { name: /start training or challenge/i });
    expect(trainLink.className).toContain("bg-primary");
    expect(trainLink.className).toContain("text-on-primary");

    // View on map is secondary CTA
    const mapLink = screen.getByRole("link", { name: /view largo do intendente spot on the map/i });
    expect(mapLink.className).toContain("bg-surface-container-high");
    expect(mapLink.className).toContain("text-on-surface");
    expect(mapLink.className).not.toContain("bg-primary");

    // Directions are side by side in a 2-column grid
    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid).toBeTruthy();
    expect(screen.getByRole("link", { name: /google maps/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /waze/i })).toBeTruthy();
  });
});
