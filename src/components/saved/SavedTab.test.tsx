import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Spot } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  useSavedSpots: vi.fn(),
  useSavedSpotList: vi.fn(),
  useVerifiedSpots: vi.fn(),
  useVerifiedSpotList: vi.fn(),
  useCreatedSpots: vi.fn(),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: mocks.useUser,
}));

vi.mock("@/hooks/data/useSavedSpots", () => ({
  useSavedSpots: mocks.useSavedSpots,
}));

vi.mock("@/hooks/data/useSavedSpotList", () => ({
  useSavedSpotList: mocks.useSavedSpotList,
}));

vi.mock("@/hooks/data/useVerifiedSpots", () => ({
  useVerifiedSpots: mocks.useVerifiedSpots,
}));

vi.mock("@/hooks/data/useVerifiedSpotList", () => ({
  useVerifiedSpotList: mocks.useVerifiedSpotList,
}));

vi.mock("@/hooks/data/useCreatedSpots", () => ({
  useCreatedSpots: mocks.useCreatedSpots,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/saved",
}));

import SavedTab from "./SavedTab";

function spot(id: string, name: string): Spot {
  return {
    id,
    slug: `slug-${id}`,
    name,
    city: "Bogota",
    citySlug: "bogota",
    address: "calle 1",
    types: [],
    sports: [],
    image: "",
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 0,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat: 4.6, lon: -74.06 },
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  mocks.useUser.mockReturnValue({ id: "user-1" });
  mocks.useSavedSpots.mockReturnValue({
    savedIds: new Set<string>(),
    isSaved: () => false,
    toggle: vi.fn(),
    count: 0,
  });
  mocks.useSavedSpotList.mockReturnValue({
    items: [] as readonly Spot[],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mocks.useVerifiedSpots.mockReturnValue({
    verifiedIds: new Set<string>(),
    isVerified: () => false,
    toggle: vi.fn(),
    count: 0,
  });
  mocks.useVerifiedSpotList.mockReturnValue({
    items: [] as readonly Spot[],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mocks.useCreatedSpots.mockReturnValue({
    items: [] as readonly Spot[],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
});

describe("SavedTab", () => {
  it("renders a saved spot that lives outside the (capped) client directory", async () => {
    mocks.useSavedSpots.mockReturnValue({
      savedIds: new Set(["out-of-cap"]),
      isSaved: () => true,
      toggle: vi.fn(),
      count: 1,
    });
    mocks.useSavedSpotList.mockReturnValue({
      items: [spot("out-of-cap", "Far Away Spot")] as readonly Spot[],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<SavedTab />);

    const tab = await screen.findByRole("tab", { name: /saved 1/i });
    await userEvent.click(tab);
    expect(
      await screen.findByText("Far Away Spot"),
    ).toBeInTheDocument();
  });

  it("renders the verified grid from fetched entities, not the directory", async () => {
    mocks.useVerifiedSpots.mockReturnValue({
      verifiedIds: new Set(["v-out-of-cap"]),
      isVerified: () => true,
      toggle: vi.fn(),
      count: 1,
    });
    mocks.useVerifiedSpotList.mockReturnValue({
      items: [spot("v-out-of-cap", "Verified Terreno")] as readonly Spot[],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<SavedTab />);

    const tab = await screen.findByRole("tab", { name: /verified 1/i });
    await userEvent.click(tab);
    expect(
      await screen.findByText("Verified Terreno"),
    ).toBeInTheDocument();
  });
});
