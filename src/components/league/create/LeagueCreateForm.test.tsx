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
    const essentials = screen.getByRole("group", { name: /contest essentials/i });
    expect(within(essentials).getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^cancel$/i })).toHaveAttribute(
      "href",
      "/league",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /create a contest/i }),
    ).toBeInTheDocument();
  });

  it("defaults the timezone to the browser zone", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    render(<LeagueCreateForm />);
    expect(screen.getByLabelText(/timezone/i)).toHaveValue(zone);
  });

  it("focuses the first invalid field when submitted empty", () => {
    render(<LeagueCreateForm />);
    fireEvent.click(screen.getByRole("button", { name: /create contest/i }));
    const name = screen.getByLabelText(/contest name/i);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();
  });

  it("blocks malformed organizer links on the client", () => {
    render(<LeagueCreateForm />);
    fireEvent.change(screen.getByLabelText(/official site/i), {
      target: { value: "not a url" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create contest/i }));
    expect(screen.getByLabelText(/official site/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("rejects oversized or non-image covers before upload", () => {
    render(<LeagueCreateForm />);
    const input = screen.getByLabelText(/cover image/i);
    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "notes.txt", { type: "text/plain" })],
      },
    });
    expect(screen.getByText(/use a png, jpg, webp or avif image/i)).toBeInTheDocument();
  });
});
