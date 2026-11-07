import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MapAreaBar, type MapAreaBarProps } from "./MapAreaBar";

vi.mock("@/hooks/preferences/useDistanceUnit", () => ({
  useDistanceUnit: () => "mi",
}));

function renderBar(overrides: Partial<MapAreaBarProps> = {}) {
  const onSelectRadius = vi.fn();
  const onShowSpot = vi.fn();
  render(
    <MapAreaBar
      spotName="SOPO SKATEPARK"
      count={23}
      loading={false}
      aroundMiles={10}
      onSelectRadius={onSelectRadius}
      onShowSpot={onShowSpot}
      cityName="Bogota"
      onlyCityHref="/map?country=colombia&city=bogota"
      {...overrides}
    />,
  );
  return { onSelectRadius, onShowSpot };
}

describe("MapAreaBar", () => {
  it("says what is shown and how many spots", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: "Show SOPO SKATEPARK details" })
        .textContent,
    ).toBe("SOPO SKATEPARK");
    expect(screen.getByText("23 spots")).toBeTruthy();
  });

  it("renders the radius options as a radio group with the current one checked", () => {
    renderBar({ aroundMiles: 25 });
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["10 mi", "25 mi", "50 mi"]);
    expect(radios[1]?.getAttribute("aria-checked")).toBe("true");
    expect(radios[0]?.getAttribute("aria-checked")).toBe("false");
  });

  it("selects a radius on click and with arrow keys", () => {
    const { onSelectRadius } = renderBar();
    fireEvent.click(screen.getByRole("radio", { name: "50 mi" }));
    expect(onSelectRadius).toHaveBeenLastCalledWith(50);
    fireEvent.keyDown(screen.getByRole("radio", { name: "10 mi" }), {
      key: "ArrowRight",
    });
    expect(onSelectRadius).toHaveBeenLastCalledWith(25);
  });

  it("opens the focused spot from its name", () => {
    const { onShowSpot } = renderBar();
    fireEvent.click(
      screen.getByRole("button", { name: "Show SOPO SKATEPARK details" }),
    );
    expect(onShowSpot).toHaveBeenCalledTimes(1);
  });

  it("keeps the map popup open on taps inside the bar", () => {
    renderBar();
    expect(
      screen.getByRole("group", { name: "Spots around SOPO SKATEPARK" })
        .hasAttribute("data-map-keep-popup"),
    ).toBe(true);
  });

  it("links back to the city filter", () => {
    renderBar();
    const link = screen.getByRole("link", { name: "Show only spots in Bogota" });
    expect(link.getAttribute("href")).toBe("/map?country=colombia&city=bogota");
  });

  it("hides the city link when the spot has no city", () => {
    renderBar({ cityName: null, onlyCityHref: null });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows a loading label while the area walk runs", () => {
    renderBar({ count: 1, loading: true });
    expect(screen.getByText("Finding spots…")).toBeTruthy();
  });
});
