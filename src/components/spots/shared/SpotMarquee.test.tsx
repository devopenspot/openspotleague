import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpotMarquee } from "./SpotMarquee";

const mockItems = [
  { id: "spot-1", title: "Praça Martim Moniz" },
  { id: "spot-2", title: "Praça da Figueira" },
  { id: "spot-3", title: "Campo das Cebolas" },
  { id: "spot-4", title: "Doca da Caldeirinha" },
];

describe("SpotMarquee", () => {
  it("renders carousel region and slides with ARIA roles", () => {
    render(
      <SpotMarquee
        items={mockItems}
        ariaLabel="Suggested spots in Lisbon"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    const region = screen.getByRole("region", { name: "Suggested spots in Lisbon" });
    expect(region).toBeTruthy();
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");

    const slides = screen.getAllByRole("group");
    expect(slides).toHaveLength(4);
    expect(slides[0]?.getAttribute("aria-roledescription")).toBe("slide");
    expect(slides[0]?.getAttribute("aria-label")).toBe("1 of 4");
    expect(screen.getByText("Praça Martim Moniz")).toBeTruthy();
  });

  it("returns null when items array is empty", () => {
    const { container } = render(
      <SpotMarquee
        items={[]}
        ariaLabel="Empty list"
        renderItem={() => <div>item</div>}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders desktop chevron scroll buttons", () => {
    render(
      <SpotMarquee
        items={mockItems}
        ariaLabel="Suggested spots"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    const prevButton = screen.getByRole("button", { name: "Scroll left" });
    const nextButton = screen.getByRole("button", { name: "Scroll right" });

    expect(prevButton).toBeTruthy();
    expect(nextButton).toBeTruthy();
  });

  it("handles keyboard navigation (ArrowLeft, ArrowRight, Home, End)", () => {
    render(
      <SpotMarquee
        items={mockItems}
        ariaLabel="Suggested spots"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    const region = screen.getByRole("region", { name: "Suggested spots" });
    const scrollBySpy = vi.fn();
    const scrollToSpy = vi.fn();
    region.scrollBy = scrollBySpy;
    region.scrollTo = scrollToSpy;

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollBySpy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number), behavior: "smooth" }),
    );

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(scrollBySpy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number), behavior: "smooth" }),
    );

    fireEvent.keyDown(region, { key: "Home" });
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 0, behavior: "smooth" }),
    );

    fireEvent.keyDown(region, { key: "End" });
    expect(scrollToSpy).toHaveBeenCalled();
  });
});
