import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandLogo, DEFAULT_BRAND_LOGO } from "./BrandLogo";

describe("BrandLogo", () => {
  it("renders with default logo when no image is provided", () => {
    const { container } = render(<BrandLogo />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      DEFAULT_BRAND_LOGO,
    );
  });

  it("renders with custom image when image prop is provided", () => {
    const { container } = render(
      <BrandLogo image="/custom-partner.png" alt="Partner Logo" />,
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/custom-partner.png",
    );
    expect(img).toHaveAttribute("alt", "Partner Logo");
  });

  it("renders with custom image when src alias is provided", () => {
    const { container } = render(<BrandLogo src="/custom-via-src.png" />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/custom-via-src.png",
    );
  });

  it("prefers image prop over src alias", () => {
    const { container } = render(
      <BrandLogo image="/priority-image.png" src="/secondary-src.png" />,
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/priority-image.png",
    );
  });
});
