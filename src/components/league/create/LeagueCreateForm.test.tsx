import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LeagueCreateForm } from "./LeagueCreateForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/league/new",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/admin/spots/hooks/useCountries", () => ({
  useCountries: () => ({ items: [], isLoading: false, error: null }),
}));

describe("LeagueCreateForm", () => {
  it("puts Category in the essentials section and Cancel links to the hub", () => {
    render(<LeagueCreateForm organizerName="Sam" />);
    const essentials = screen.getByRole("group", { name: /event essentials/i });
    expect(within(essentials).getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^cancel$/i })).toHaveAttribute(
      "href",
      "/league",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /create a sport event/i }),
    ).toBeInTheDocument();
  });

  it("defaults the timezone to the browser zone", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    render(<LeagueCreateForm />);
    expect(screen.getByLabelText(/timezone/i)).toHaveValue(zone);
  });

  it("focuses the first invalid field when submitted empty", () => {
    render(<LeagueCreateForm />);
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));
    const name = screen.getByLabelText(/event name/i);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();
  });
});
