import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapCityLoader } from "./MapCityLoader";

afterEach(() => {
  vi.useRealTimers();
});

describe("MapCityLoader", () => {
  it("renders nothing when closed", () => {
    render(<MapCityLoader isOpen={false} className="inline" />);

    expect(screen.queryByTestId("map-city-loader")).not.toBeInTheDocument();
  });

  it("shows the generic carousel copy when open without a city name", () => {
    render(<MapCityLoader isOpen className="fixed inset-0" />);

    const loader = screen.getByTestId("map-city-loader");
    expect(loader).toHaveAttribute("role", "status");
    expect(loader).toHaveAttribute("aria-busy", "true");
    expect(loader).toHaveAttribute("aria-label", "Loading city spots");
    expect(
      // The visible headline (the sr-only live region repeats the text too).
      screen.getAllByText("Centering The Map…")[0],
    ).toBeInTheDocument();
    expect(screen.getByText("Hang Tight")).toBeInTheDocument();
    expect(
      screen.getByText("Keep the map open — we’re syncing the city grid."),
    ).toBeInTheDocument();
  });

  it("tailors the first messages with the picked city name", () => {
    render(<MapCityLoader isOpen cityName="Barcelona" className="inline" />);

    expect(
      screen.getAllByText("Centering Barcelona On The Map…")[0],
    ).toBeInTheDocument();
  });

  it("advances the carousel over time and wraps at the end", () => {
    // happy-dom can report prefers-reduced-motion as matching; force the
    // animated path so the interval carousel actually runs. The motion
    // headline animates on its own rAF clock (not assertable under fake
    // timers), so assert the sr-only live region, which mirrors the
    // current message synchronously.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.useFakeTimers();
    render(<MapCityLoader isOpen className="inline" />);
    const srOnlyText = () =>
      screen
        .getByTestId("map-city-loader")
        .querySelector("p.sr-only")?.textContent;

    expect(srOnlyText()).toBe("Centering The Map…");

    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(srOnlyText()).toBe("Syncing The Spot Grid…");

    act(() => {
      vi.advanceTimersByTime(1900 * 3);
    });
    expect(srOnlyText()).toBe("Centering The Map…");
    vi.unstubAllGlobals();
  });
});
