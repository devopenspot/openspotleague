import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JudgeQueue } from "./JudgeQueue";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/sport-events/test-event/judge",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => ({ id: "judge-1", name: "Judge One", email: "j@x.dev" }),
}));

vi.mock("@/components/league/hooks/useLeagueRealtime", () => ({
  useLeagueRealtime: () => "connected",
}));

const criteria = [
  { key: "style", label: "Style", weight: 1, maxScore: 10, sortOrder: 0 },
];

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: "event-1",
      slug: "test-event",
      name: "Test Event",
      shortName: null,
      description: null,
      status: "live",
      planSlug: "free",
      origin: "community",
      visibility: "public",
      timezone: "UTC",
      category: "skateboard",
      categoryName: "Skateboard",
      imageUrl: null,
      startDate: "2026-10-01",
      endDate: null,
      city: "Barcelona",
      address: null,
      venue: null,
      country: "Spain",
      countryCode: "ES",
      latitude: null,
      longitude: null,
      version: 1,
      startAt: "2026-10-01T18:00:00.000Z",
    },
    myRole: "judge",
    counts: { riders: 1, judges: 1, organizers: 1 },
    criteria,
    runs: [],
    results: [],
    invites: [],
    payment: {
      state: "paid",
      paymentDueAt: null,
      paymentDeadlineAt: null,
      hasActivePayment: false,
      activePayment: null,
    },
    readOnly: false,
    notice: null,
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("JudgeQueue", () => {
  it("renders the current run with an empty submit form", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        baseState({
          runs: [
            {
              id: "run-1",
              sequence: 1,
              riderUserId: "rider-1",
              riderName: "Rider One",
              status: "judging",
              scheduledAt: null,
              windowStartedAt: "2026-09-13T10:00:00.000Z",
              windowEndsAt: "2099-01-01T10:05:00.000Z",
              scores: [],
            },
          ],
        }),
    });
    render(<JudgeQueue eventId="event-1" slug="test-event" />);
    expect(await screen.findByText("Rider One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit score" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase Style" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Extend 5 min" }),
    ).not.toBeInTheDocument();
  });

  it("prefills and relabels for revise when the judge already scored", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        baseState({
          runs: [
            {
              id: "run-1",
              sequence: 1,
              riderUserId: "rider-1",
              riderName: "Rider One",
              status: "judging",
              scheduledAt: null,
              windowStartedAt: null,
              windowEndsAt: "2099-01-01T10:05:00.000Z",
              scores: [
                {
                  judgeUserId: "judge-1",
                  judgeName: "Judge One",
                  criteria: { style: 7 },
                  total: 7,
                },
              ],
            },
          ],
        }),
    });
    render(<JudgeQueue eventId="event-1" slug="test-event" />);
    expect(await screen.findByRole("button", { name: "Revise score" })).toBeInTheDocument();
    expect(
      screen.getByText(/Your current total: 7\.00/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows organizer window controls only for organizers", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        baseState({
          myRole: "main_organizer",
          runs: [
            {
              id: "run-1",
              sequence: 1,
              riderUserId: "rider-1",
              riderName: "Rider One",
              status: "judging",
              scheduledAt: null,
              windowStartedAt: null,
              windowEndsAt: "2099-01-01T10:05:00.000Z",
              scores: [],
            },
          ],
        }),
    });
    render(<JudgeQueue eventId="event-1" slug="test-event" />);
    expect(await screen.findByRole("button", { name: "Extend 5 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close window" })).toBeInTheDocument();
  });

  it("lists my past submissions", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        baseState({
          runs: [
            {
              id: "run-1",
              sequence: 1,
              riderUserId: "rider-1",
              riderName: "Rider One",
              status: "scored",
              scheduledAt: null,
              windowStartedAt: null,
              windowEndsAt: null,
              scores: [
                {
                  judgeUserId: "judge-1",
                  judgeName: "Judge One",
                  criteria: { style: 9 },
                  total: 9,
                },
              ],
            },
          ],
        }),
    });
    render(<JudgeQueue eventId="event-1" slug="test-event" />);
    expect(await screen.findByText("Rider One")).toBeInTheDocument();
    expect(screen.getByText("9.00 pts")).toBeInTheDocument();
    expect(
      screen.getByText("No run is being judged right now. The queue updates automatically."),
    ).toBeInTheDocument();
  });
});
