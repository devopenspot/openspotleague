import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppImage } from "./AppImage";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    <span
      data-testid="next-image-mock"
      data-src={props.src}
      data-alt={props.alt}
    />
  ),
}));

const FALLBACK = "/opengraph.png";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AppImage empty-src guard", () => {
  it("falls back instead of rendering an empty src when src is an empty string", async () => {
    render(<AppImage src="" alt="Spot photo" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("next-image-mock").getAttribute("data-src"),
      ).toBe(FALLBACK);
    });
  });

  it("falls back when src is only whitespace", async () => {
    render(<AppImage src="   " alt="Spot photo" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("next-image-mock").getAttribute("data-src"),
      ).toBe(FALLBACK);
    });
  });

  it("falls back when src is null at runtime", async () => {
    render(<AppImage src={null as unknown as string} alt="Spot photo" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("next-image-mock").getAttribute("data-src"),
      ).toBe(FALLBACK);
    });
  });

  it("keeps a valid src", () => {
    render(<AppImage src="https://example.com/photo.webp" alt="Spot photo" />);

    expect(screen.getByTestId("next-image-mock").getAttribute("data-src")).toBe(
      "https://example.com/photo.webp",
    );
  });

  it("keeps applying the guard when the src prop changes to an empty value", async () => {
    const { rerender } = render(
      <AppImage src="https://example.com/photo.webp" alt="Spot photo" />,
    );
    expect(screen.getByTestId("next-image-mock").getAttribute("data-src")).toBe(
      "https://example.com/photo.webp",
    );

    rerender(<AppImage src="" alt="Spot photo" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("next-image-mock").getAttribute("data-src"),
      ).toBe(FALLBACK);
    });
  });
});
