import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpotWeatherVerificationDialog } from "./SpotWeatherVerificationDialog";
import type { MapSpot } from "@/lib/types";

const mockUser = { id: "user-1", email: "test@example.com" };
vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => mockUser,
}));

const mockLocation = { lat: 38.72, lon: -9.13, accuracy: 10 };
const mockRequest = vi.fn().mockResolvedValue("granted");
vi.mock("@/hooks/map/useUserLocation", () => ({
  useUserLocation: () => ({
    location: mockLocation,
    status: "granted",
    request: mockRequest,
  }),
}));

const mockForecastWeather = {
  icon: "rain",
  current: 16,
  description: "moderate rain",
  tempMin: 14,
  tempMax: 18,
  wind: 3,
  humidity: 80,
  precipitationMm: 2,
  fetchedAt: Date.now(),
};
vi.mock("@/hooks/data/useSpotWeather", () => ({
  useSpotWeather: (spotId: string | null) => ({
    weather: spotId ? mockForecastWeather : undefined,
  }),
}));

const mockVerifyFn = vi.fn().mockResolvedValue({
  ok: true,
  count: 4,
  weather: {
    active: true,
    leader: "cloudy",
    count: 2,
    expiresAt: "2026-01-01T02:00:00.000Z",
    totalActive: 3,
  },
});
const mockSummaryState = {
  summary: null as unknown,
  verifying: false,
  verify: mockVerifyFn,
  refresh: vi.fn(),
  loading: false,
  error: null,
};
vi.mock("@/hooks/data/useWeatherVerification", () => ({
  useWeatherVerification: (spotId: string | null) => {
    if (!spotId) return { ...mockSummaryState, summary: null };
    return mockSummaryState;
  },
}));

vi.mock("@/hooks/ui/useToast", () => ({
  showToast: vi.fn(),
}));

const mockSpot: MapSpot = {
  id: "spot-123",
  name: "Terreiro do Paco Skate",
  slug: "terreiro-do-paco",
  city: "Lisboa",
  citySlug: "lisboa",
  country: "Portugal",
  countryCode: "PT",
  location: { lat: 38.72, lon: -9.13 },
  image: "https://example.com/spot.jpg",
  types: [{ name: "Street", slug: "street" }],
  sports: ["Skateboard"],
  verificationCount: 3,
  instagram: null,
};

describe("SpotWeatherVerificationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSummaryState.summary = null;
  });

  it("does not render dialog content when isOpen is false", () => {
    render(
      <SpotWeatherVerificationDialog
        isOpen={false}
        onClose={vi.fn()}
        spot={mockSpot}
      />,
    );

    expect(screen.queryByText("Verify weather")).toBeNull();
  });

  it("renders forecast information and confirmation buttons when open", () => {
    render(
      <SpotWeatherVerificationDialog
        isOpen={true}
        onClose={vi.fn()}
        spot={mockSpot}
      />,
    );

    expect(screen.getByText("Verify weather")).toBeTruthy();
    expect(screen.getByText(mockSpot.name)).toBeTruthy();
    expect(screen.getByText("Is the forecast correct right now?")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Yes, correct" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "No, different" })).toBeTruthy();
  });

  it("displays community status dual tiny icons when weatherSummary is active", () => {
    mockSummaryState.summary = {
      active: true,
      leader: "cloudy",
      count: 2,
      expiresAt: "2026-01-01T02:00:00.000Z",
      totalActive: 3,
    };

    render(
      <SpotWeatherVerificationDialog
        isOpen={true}
        onClose={vi.fn()}
        spot={mockSpot}
      />,
    );

    expect(screen.getByText("Community status")).toBeTruthy();
    expect(screen.getByText("Forecast vs. most voted live condition")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("allows selecting 'Yes, correct' and submitting verification", async () => {
    const onClose = vi.fn();
    const onVerified = vi.fn();

    render(
      <SpotWeatherVerificationDialog
        isOpen={true}
        onClose={onClose}
        spot={mockSpot}
        onVerified={onVerified}
      />,
    );

    const yesRadio = screen.getByRole("radio", { name: "Yes, correct" });
    fireEvent.click(yesRadio);

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    expect(verifyBtn.getAttribute("disabled")).toBeNull();

    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(mockVerifyFn).toHaveBeenCalledWith({
        latitude: 38.72,
        longitude: -9.13,
        accuracyMeters: 10,
        voteIcon: "rain",
      });
      expect(onClose).toHaveBeenCalled();
      expect(onVerified).toHaveBeenCalledWith(
        expect.objectContaining({ leader: "cloudy", count: 2 }),
      );
    });
  });

  it("allows selecting 'No, different' and picking one of the live weather options", async () => {
    const onClose = vi.fn();

    render(
      <SpotWeatherVerificationDialog
        isOpen={true}
        onClose={onClose}
        spot={mockSpot}
      />,
    );

    const noRadio = screen.getByRole("radio", { name: "No, different" });
    fireEvent.click(noRadio);

    expect(screen.getByText("Select the live weather you see")).toBeTruthy();
    const sunnyOption = screen.getByRole("radio", { name: /sunny/i });
    fireEvent.click(sunnyOption);

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    expect(verifyBtn.getAttribute("disabled")).toBeNull();

    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(mockVerifyFn).toHaveBeenCalledWith({
        latitude: 38.72,
        longitude: -9.13,
        accuracyMeters: 10,
        voteIcon: "sunny",
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
