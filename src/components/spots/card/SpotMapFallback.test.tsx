import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpotMapFallback } from "./SpotMapFallback";

describe("SpotMapFallback", () => {
  it("renders dark-mode tile images inside a dark canvas container", () => {
    const { container } = render(
      <SpotMapFallback lat={41.3851} lon={2.1734} title="MACBA" />,
    );

    const root = container.firstElementChild;
    expect(root?.className).toContain("bg-map-surface");

    const tileImages = container.querySelectorAll("img.map-tile-dark");
    expect(tileImages.length).toBeGreaterThan(0);

    const pinBadge = screen.getByTitle("MACBA");
    expect(pinBadge.className).toContain("bg-map-surface-container");
    expect(screen.getByText("© OpenStreetMap")).toBeTruthy();
  });

  it("applies the dark tile class to both base and lens tile grids when lens is enabled", () => {
    const { container } = render(
      <SpotMapFallback lat={41.3851} lon={2.1734} title="MACBA" lens />,
    );

    const baseTiles = container.querySelectorAll("img.map-tile-dark");
    const withoutLens = render(
      <SpotMapFallback lat={41.3851} lon={2.1734} title="MACBA" />,
    );
    const singleGridCount =
      withoutLens.container.querySelectorAll("img.map-tile-dark").length;

    expect(baseTiles.length).toBe(singleGridCount * 2);
  });

  it("renders shortened attribution and compact pin in compact mode", () => {
    render(
      <SpotMapFallback lat={41.3851} lon={2.1734} title="MACBA" compact />,
    );

    const pinBadge = screen.getByTitle("MACBA");
    expect(pinBadge.className).toContain("h-6 w-6");
    expect(screen.getByText("© OSM")).toBeTruthy();
  });
});
