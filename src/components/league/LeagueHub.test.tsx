import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LeagueHub from "./LeagueHub";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/league",
  useSearchParams: () => new URLSearchParams(),
}));

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "e1",
    slug: "night-jam",
    name: "Night Jam",
    status: "draft",
    planSlug: "free",
    timezone: "UTC",
    startDate: "2026-10-01",
    endDate: null,
    version: 1,
    myRole: "main_organizer",
    paymentState: "settled",
    paymentDueAt: null,
    paymentDeadlineAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("LeagueHub", () => {
  it("shows the empty state with a create CTA", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    render(<LeagueHub />);
    expect(await screen.findByText("No events yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create an event/i })).toHaveAttribute(
      "href",
      "/league/new",
    );
  });

  it("groups events by role and deep-links organizers to manage", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          item({ id: "e1", name: "Night Jam", myRole: "main_organizer" }),
          item({
            id: "e2",
            slug: "city-cup",
            name: "City Cup",
            myRole: "rider",
          }),
          item({ id: "e3", name: "Park Series", myRole: "judge" }),
        ],
      }),
    });
    render(<LeagueHub />);
    expect(await screen.findByText("Night Jam")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /organizing · 1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /judging · 1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /riding · 1/i })).toBeInTheDocument();
    const manageLink = screen.getByRole("link", { name: /night jam/i });
    expect(manageLink).toHaveAttribute("href", "/sport-events/night-jam/manage");
    const riderLink = screen.getByRole("link", { name: /city cup/i });
    expect(riderLink).toHaveAttribute("href", "/sport-events/city-cup");
  });

  it("surfaces the payment notice for gated events", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          item({
            paymentState: "locked",
            paymentDueAt: "2026-09-10T12:00:00.000Z",
            paymentDeadlineAt: "2026-09-13T12:00:00.000Z",
          }),
        ],
      }),
    });
    render(<LeagueHub />);
    expect(await screen.findByRole("status")).toHaveAttribute(
      "data-payment-state",
      "locked",
    );
    expect(screen.getByText(/read-only until a payment/i)).toBeInTheDocument();
  });

  it("shows the error state when the API fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<LeagueHub />);
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/could not be loaded/i);
  });
});
