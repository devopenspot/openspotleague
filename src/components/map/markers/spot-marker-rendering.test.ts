import { describe, expect, it } from "vitest";
import { buildSpotPinHTML, getPinDimensions } from "@/components/map/markers/spot-marker-rendering";

const baseOptions = {
  active: false,
  saved: false,
  showDistance: true,
  weather: "sunny" as const,
  tempLabel: "22°C",
  distanceLabel: "1.2 km",
  name: "Downtown Plaza",
};

describe("spot marker interaction targets", () => {
  it("keeps minimal marker targets at least 24 pixels high", () => {
    expect(getPinDimensions(false, false, false).size[1]).toBeGreaterThanOrEqual(24);
    expect(getPinDimensions(true, false, false).size[1]).toBeGreaterThanOrEqual(24);
  });

  it("preserves the marker anchor at the bottom of minimal targets", () => {
    const inactive = getPinDimensions(false, false, false);
    const active = getPinDimensions(true, false, false);

    expect(inactive.anchor[1]).toBe(inactive.size[1]);
    expect(active.anchor[1]).toBe(active.size[1]);
  });

  it("keeps every marker variant anchored to its lower edge", () => {
    for (const active of [false, true]) {
      for (const showWeather of [false, true]) {
        for (const showDistance of [false, true]) {
          const dimensions = getPinDimensions(
            active,
            showWeather,
            showDistance,
          );
          expect(dimensions.anchor[1]).toBe(dimensions.size[1]);
        }
      }
    }
  });
});

describe("spot marker rendering", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])("renders one surface when weather=%s and distance=%s", (showWeather, showDistance) => {
    const html = buildSpotPinHTML({
      ...baseOptions,
      showDistance,
      weather: showWeather ? baseOptions.weather : null,
    });

    expect(html.match(/class="leaflet-pin__surface/g)).toHaveLength(1);
    expect(html.match(/leaflet-pin__row/g)).toHaveLength(1 + Number(showDistance) + Number(showWeather));
    expect(html).not.toContain("leaflet-pin__square");
    expect(html).toContain("Downtown Plaza");
    if (showDistance) expect(html).toContain("1.2 km");
    else expect(html).not.toContain("leaflet-pin__distance");
    if (showWeather) expect(html).toContain("22°C");
    else expect(html).not.toContain("leaflet-pin__temp");
  });

  it("adds a visible saved state to the rendered marker", () => {
    const html = buildSpotPinHTML({
      ...baseOptions,
      saved: true,
    });

    expect(html).toContain("leaflet-pin--saved");
  });
});
