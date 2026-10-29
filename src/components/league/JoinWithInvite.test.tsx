import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JoinWithInvite } from "./JoinWithInvite";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/sport-events/join/abcdefgh1234",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => null,
}));

function preview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventSlug: "night-jam",
    eventName: "Night Jam",
    eventStartAt: "2026-10-01T18:00:00.000Z",
    timezone: "UTC",
    city: "Barcelona",
    role: "rider",
    usable: true,
    reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("JoinWithInvite", () => {
  it("renders the public preview with event context", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => preview() });
    render(<JoinWithInvite code="abcdefgh1234" />);
    expect(await screen.findByText("Night Jam")).toBeInTheDocument();
    expect(screen.getByText(/Invited as Rider/i)).toBeInTheDocument();
    expect(screen.getByText("Barcelona")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/league/invites/abcdefgh1234",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("recovers from a network error without staying stuck on the loading skeleton", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<JoinWithInvite code="abcdefgh1234" />);
    expect(
      await screen.findByText(/could not be loaded/i),
    ).toBeInTheDocument();
  });

  it("shows the revoke/expiry reason instead of a join CTA", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => preview({ usable: false, reason: "This invite has expired" }),
    });
    render(<JoinWithInvite code="abcdefgh1234" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This invite has expired",
    );
  });

  it("shows the not-found alert for unknown codes", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<JoinWithInvite code="nope12345" />);
    expect(
      await screen.findByText(/could not be found/i),
    ).toBeInTheDocument();
  });
});
