import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DEFAULT_PAYPAL_SUPPORT_URL } from "@/lib/config/env";
import SupportPage from "./page";

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="paypal-qr" data-value={value} />
  ),
}));

describe("SupportPage PayPal integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders both PayPal CTAs and QR code with the default PayPal URL and secure attributes", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_URL", "");
    render(<SupportPage />);

    const heroLink = screen.getByRole("link", {
      name: /support open spot via paypal/i,
    });
    expect(heroLink).toHaveAttribute("href", DEFAULT_PAYPAL_SUPPORT_URL);
    expect(heroLink).toHaveAttribute("target", "_blank");
    expect(heroLink).toHaveAttribute("rel", "noopener noreferrer");

    const paypalSection = screen.getByRole("region", { name: /paypal/i });
    const cardLink = within(paypalSection).getByRole("link", {
      name: /donate via paypal/i,
    });
    expect(cardLink).toHaveAttribute("href", DEFAULT_PAYPAL_SUPPORT_URL);
    expect(cardLink).toHaveAttribute("target", "_blank");
    expect(cardLink).toHaveAttribute("rel", "noopener noreferrer");

    const qr = within(paypalSection).getByTestId("paypal-qr");
    expect(qr).toHaveAttribute("data-value", DEFAULT_PAYPAL_SUPPORT_URL);
  });

  it("uses a configured valid NEXT_PUBLIC_PAYPAL_URL across links and QR code", () => {
    const customUrl = "https://paypal.me/openspotleague";
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_URL", customUrl);
    render(<SupportPage />);

    const heroLink = screen.getByRole("link", {
      name: /support open spot via paypal/i,
    });
    expect(heroLink).toHaveAttribute("href", customUrl);

    const paypalSection = screen.getByRole("region", { name: /paypal/i });
    const cardLink = within(paypalSection).getByRole("link", {
      name: /donate via paypal/i,
    });
    expect(cardLink).toHaveAttribute("href", customUrl);
    expect(within(paypalSection).getByTestId("paypal-qr")).toHaveAttribute(
      "data-value",
      customUrl,
    );
  });

  it("falls back to the default PayPal URL if NEXT_PUBLIC_PAYPAL_URL is not a valid https PayPal link", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_URL", "http://insecure.example.com/pay");
    render(<SupportPage />);

    const heroLink = screen.getByRole("link", {
      name: /support open spot via paypal/i,
    });
    expect(heroLink).toHaveAttribute("href", DEFAULT_PAYPAL_SUPPORT_URL);
  });
});
