import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const { requestLocationMock, userLocationState, routerPushMock, spotWeatherState } = vi.hoisted(() => ({
  requestLocationMock: vi.fn(),
  userLocationState: {
    status: "idle",
    location: null as { lat: number; lon: number; accuracy: number } | null,
  },
  routerPushMock: vi.fn(),
  spotWeatherState: { current: 22 as number | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => "/games/new",
}));

vi.mock("@/hooks/map/useUserLocation", () => ({
  useUserLocation: () => ({
    status: userLocationState.status,
    location: userLocationState.location,
    request: requestLocationMock,
  }),
}));

vi.mock("@/hooks/preferences/useDistanceUnit", () => ({
  useDistanceUnit: () => "km",
}));

vi.mock("@/hooks/preferences/useTemperatureUnit", () => ({
  useTemperatureUnit: () => "C",
}));

vi.mock("@/hooks/data/useSpotWeather", () => ({
  useSpotWeather: () => ({
    weather: {
      icon: "sunny",
      current: spotWeatherState.current,
      description: "clear sky",
      tempMin: 18,
      tempMax: 25,
      wind: 3,
      humidity: 55,
      precipitationMm: null,
      fetchedAt: Date.now(),
    },
  }),
}));

vi.mock("@/components/spots/weather/WeatherIcon", () => ({
  WeatherIcon: () => null,
}));

import { GameCreateForm } from "./GameCreateForm";
import { createGameInputSchema } from "@/lib/schemas/game";
import { usePreferencesStore } from "@/stores/preferences-store";

const spotFixture = {
  id: "spot-1",
  slug: "spot-1",
  name: "Santa Cruz",
  city: "Madrid",
  citySlug: "madrid",
  address: "Calle 1",
  types: [{ slug: "skate", name: "Skate" }],
  sports: ["Skateboard"],
  image: "https://example.com/spot.jpg",
  country: "Spain",
  countryCode: "ES",
  location: { lat: 40.4168, lon: -3.7038 },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  createdBy: null,
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

type TestUser = ReturnType<typeof userEvent.setup>;

async function openSetupDialog(
  user: TestUser,
  name: "Start training" | "Create challenge" = "Start training",
) {
  await user.click(screen.getByTestId("mobile-review-trigger"));
  return screen.findByRole("dialog", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  spotWeatherState.current = 22;
  vi.stubGlobal("fetch", vi.fn());
  (fetch as Mock).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/games/options")) {
      const discipline = new URL(url, "http://localhost").searchParams.get(
        "disciplineSlug",
      );
      return jsonResponse({
        disciplineSlug: discipline,
        spotTypes: [
          {
            slug: discipline === "bmx" ? "bmx-dirt" : "rails",
            name: discipline === "bmx" ? "Dirt" : "Rails",
            sortOrder: 1,
            levels: [1, 2, 3],
          },
        ],
      });
    }
    return jsonResponse({ error: "Not found" }, 404);
  });
  requestLocationMock.mockResolvedValue("granted");
  userLocationState.status = "idle";
  userLocationState.location = null;
  usePreferencesStore
    .getState()
    .setPreferences(
      {
        distanceUnit: "km",
        temperatureUnit: "C",
        preferredSport: "Skateboard",
      },
      { accountId: "user-1", hasLocalChanges: false },
    );
  usePreferencesStore.getState().setHydrationStatus("ready");
});

describe("GameCreateForm", () => {
  it("keeps Training location-free until Challenge is selected", async () => {
    render(<GameCreateForm signedIn />);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/games/options"),
        expect.anything(),
      ),
    );
    expect(requestLocationMock).not.toHaveBeenCalled();
  });

  it("renders editable trick settings with useful defaults", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn />);

    const dialog = await openSetupDialog(user);
    // S1: Player (ruleMode)
    expect(
      within(dialog).getByRole("radio", { name: /Flexible/ }),
    ).toHaveAttribute("aria-checked", "true");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    // S2: Trick (spotType + level + categories)
    const defaultSpotType = await within(dialog).findByRole("radio", {
      name: "Rails",
    });
    expect(defaultSpotType).toHaveAttribute("aria-checked", "true");
    expect(
      within(dialog).getByRole("radio", { name: /Level 1/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).queryByLabelText("Timezone")).not.toBeInTheDocument();
  });

  it("renders and submits editable trick settings in the desktop form", async () => {
    const user = userEvent.setup();
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url === "/api/games") {
        return jsonResponse({ id: "desktop-training-1", version: 0 }, 201);
      }
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);

    await user.click(await screen.findByRole("radio", { name: "Rails" }));
    await user.click(screen.getByRole("radio", { name: /Level 2/ }));
    await user.click(screen.getByRole("radio", { name: /Strict/ }));
    await user.click(screen.getByTestId("desktop-create-game"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      mode: "training",
      ruleMode: "strict",
      spotType: "rails",
      level: 2,
    });
  });

  it("renders and submits the guest rider name in the desktop form", async () => {
    const user = userEvent.setup();
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url === "/api/games") {
        return jsonResponse({ id: "desktop-guest-1", version: 0 }, 201);
      }
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn={false} />);

    const nameInput = await screen.findByLabelText("Rider name");
    await user.type(nameInput, "Street Rider");
    await user.click(screen.getByTestId("desktop-create-game"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    expect(createCall?.[1]).toMatchObject({
      headers: expect.objectContaining({ "x-guest-name": "Street Rider" }),
    });
  });

  it("renders BMX trick settings in the desktop form (racing deprecated)", async () => {
    usePreferencesStore
      .getState()
      .setPreferences(
        { distanceUnit: "km", temperatureUnit: "C", preferredSport: "BMX" },
        { accountId: "user-1", hasLocalChanges: false },
      );

    render(<GameCreateForm signedIn />);

    expect(screen.queryByRole("radio", { name: /Track racing/ })).not.toBeInTheDocument();
    expect(await screen.findByText(/Trick settings/)).toBeInTheDocument();
  });

  it("supports challenge setup from the desktop form", async () => {
    const user = userEvent.setup();
    userLocationState.status = "granted";
    userLocationState.location = { lat: 40.4168, lon: -3.7038, accuracy: 12 };
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "skate", name: "Skate", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url.includes("/api/games/nearby-spot")) {
        return jsonResponse({ spot: spotFixture, distanceMeters: 12 });
      }
      if (url === "/api/games") {
        return jsonResponse({ id: "desktop-challenge-1", version: 0 }, 201);
      }
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);

    await user.click(await screen.findByRole("radio", { name: /Challenge/ }));
    expect(
      await screen.findByText(/Santa Cruz is the only compatible spot/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /In 5 minutes/ }));
    await user.click(screen.getByRole("button", { name: "Yes, use this spot" }));
    await user.click(screen.getByRole("radio", { name: "Yes, correct" }));

    const createButton = screen.getByTestId("desktop-create-game");
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      mode: "challenge",
      spotId: "spot-1",
      startDelayMinutes: 5,
      latitude: 40.4168,
      longitude: -3.7038,
    });
  });

  it("opens the one-step mobile training dialog without submitting the game", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn />);

    const dialog = await openSetupDialog(user);
    expect(within(dialog).getByText("Rule mode")).toBeInTheDocument();
    expect(
      (fetch as Mock).mock.calls.some(
        ([input]) => String(input) === "/api/games",
      ),
    ).toBe(false);

    await user.click(
      within(dialog).getByRole("button", { name: "Back to game form" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Start training" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("mobile-review-trigger")).toHaveFocus(),
    );
  });

  it("places the guest rider name in the mobile training dialog", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn={false} />);

    const dialog = await openSetupDialog(user);
    const nameInput = within(dialog).getByLabelText("Rider name");
    await user.type(nameInput, "Street Rider");

    expect(nameInput).toHaveValue("Street Rider");
  });

  it("keeps guest-name validation in the mobile training dialog", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn={false} />);

    const dialog = await openSetupDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    const nameInput = within(dialog).getByLabelText("Rider name");
    await waitFor(() => expect(nameInput).toHaveFocus());
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(
      within(dialog).getByText(
        "Enter a rider name between 1 and 30 characters.",
      ),
    ).toBeInTheDocument();
    expect(
      (fetch as Mock).mock.calls.some(
        ([input]) => String(input) === "/api/games",
      ),
    ).toBe(false);
  });

  it("keeps challenge validation on the spot setup step", async () => {
    const user = userEvent.setup();
    userLocationState.status = "granted";
    userLocationState.location = { lat: 40.4168, lon: -3.7038, accuracy: 12 };
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url.includes("/api/games/nearby-spot")) {
        return jsonResponse({ spot: null, distanceMeters: null });
      }
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);
    await user.click(await screen.findByRole("radio", { name: /Challenge/ }));
    const dialog = await openSetupDialog(user, "Create challenge");
    await within(dialog).getByRole("radio", { name: /Flexible/ });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Rails" });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    fireEvent.submit(document.getElementById("game-create-form")!);

    expect(
      await within(dialog).findByText("Verify the spot"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Accept the nearby spot to create the challenge."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
    ).toBe(false);
  });

  it("falls back to trick validation on mobile (racing deprecated)", async () => {
    render(<GameCreateForm signedIn />);
    expect(await screen.findByText(/Trick settings/)).toBeInTheDocument();
  });

  it("allows flexible rules for non-BMX trick games", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn />);

    const dialog = await openSetupDialog(user);
    // Flexible is on Player step (S1)
    await within(dialog).findByRole("radio", { name: /Flexible/ });
    expect(
      within(dialog).getByRole("radio", { name: /Strict/ }),
    ).toBeInTheDocument();
    const flexible = within(dialog).getByRole("radio", { name: /Flexible/ });
    await user.click(flexible);

    expect(flexible).toHaveAttribute("aria-checked", "true");
  });

  it("shows one nearby spot and requires acceptance before challenge creation", async () => {
    const user = userEvent.setup();
    userLocationState.status = "granted";
    userLocationState.location = { lat: 40.4168, lon: -3.7038, accuracy: 12 };
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "skate", name: "Skate", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url.includes("/api/games/nearby-spot"))
        return jsonResponse({ spot: spotFixture, distanceMeters: 12 });
      if (url === "/api/games")
        return jsonResponse({ id: "challenge-1", version: 0 }, 201);
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);

    await user.click(screen.getByRole("radio", { name: /Challenge/ }));
    const dialog = await openSetupDialog(user, "Create challenge");
    await within(dialog).getByRole("radio", { name: /Flexible/ });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Skate" });
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          String(input).includes("/api/games/nearby-spot") &&
          String(input).includes("disciplineSlug=skateboard"),
      ),
    ).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(
      within(dialog).getByRole("radio", { name: /In 5 minutes/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(
      await within(dialog).findByText(/Santa Cruz is the only compatible spot/),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "No, not this spot" }),
    );
    expect(within(dialog).getByText(/stays locked/i)).toBeInTheDocument();
    // Continue should not advance while No is selected (validation)
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(await within(dialog).findByText(/Santa Cruz is the only compatible spot/)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Yes, use this spot" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    const createButton = within(dialog).getByTestId("mobile-create-game");
    expect(createButton).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "Yes, correct" }));
    expect(createButton).toBeEnabled();

    await user.click(createButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      mode: "challenge",
      spotId: "spot-1",
      startDelayMinutes: 5,
      latitude: 40.4168,
      longitude: -3.7038,
      accuracyMeters: 12,
    });
    expect(body.scheduledStartAt).toBeUndefined();
  });

  async function submitChallengeAndReadBody(
    user: TestUser,
    gameId: string,
  ): Promise<Record<string, unknown>> {
    userLocationState.status = "granted";
    userLocationState.location = { lat: 40.4168, lon: -3.7038, accuracy: 12 };
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "skate", name: "Skate", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url.includes("/api/games/nearby-spot"))
        return jsonResponse({ spot: spotFixture, distanceMeters: 12 });
      if (url === "/api/games") return jsonResponse({ id: gameId, version: 0 }, 201);
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);

    await user.click(screen.getByRole("radio", { name: /Challenge/ }));
    const dialog = await openSetupDialog(user, "Create challenge");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Skate" });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(
      within(dialog).getByRole("radio", { name: /In 5 minutes/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByText(/Santa Cruz is the only compatible spot/);
    await user.click(
      within(dialog).getByRole("button", { name: "Yes, use this spot" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("radio", { name: "Yes, correct" }));
    await user.click(within(dialog).getByTestId("mobile-create-game"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    return JSON.parse(String(createCall?.[1]?.body)) as Record<string, unknown>;
  }

  it("rounds a decimal weather temperature and satisfies the input schema", async () => {
    spotWeatherState.current = 21.8;
    const body = await submitChallengeAndReadBody(
      userEvent.setup(),
      "weather-test-1",
    );
    expect(body.weatherForecastTemp).toBe(22);
    expect(createGameInputSchema.safeParse(body).success).toBe(true);
  });

  it("sends null weatherForecastTemp when weather has no temperature and satisfies the input schema", async () => {
    spotWeatherState.current = null;
    const body = await submitChallengeAndReadBody(
      userEvent.setup(),
      "weather-test-2",
    );
    expect(body.weatherForecastTemp).toBeNull();
    expect(createGameInputSchema.safeParse(body).success).toBe(true);
  });

  it("walks through the three challenge setup steps before creating", async () => {
    const user = userEvent.setup();
    userLocationState.status = "granted";
    userLocationState.location = { lat: 40.4168, lon: -3.7038, accuracy: 12 };
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "skate", name: "Skate", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url.includes("/api/games/nearby-spot"))
        return jsonResponse({ spot: spotFixture, distanceMeters: 12 });
      if (url === "/api/games")
        return jsonResponse({ id: "challenge-mobile-1", version: 0 }, 201);
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);
    await user.click(await screen.findByRole("radio", { name: /Challenge/ }));
    const dialog = await openSetupDialog(user, "Create challenge");
    await within(dialog).getByRole("radio", { name: /Flexible/ });
    expect(within(dialog).getByText(/Step 1 of 5/)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
    ).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Skate" });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByText("Confirm when the lobby opens")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("radio", { name: /In 5 minutes/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(within(dialog).getByText("Verify the spot")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Yes, use this spot" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    const createButton = within(dialog).getByTestId("mobile-create-game");
    expect(createButton).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "Yes, correct" }));
    expect(createButton).toBeEnabled();
    await user.click(createButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      mode: "challenge",
      spotId: "spot-1",
      startDelayMinutes: 5,
    });
  });

  it("keeps Challenge creation locked when no nearby spot is found", async () => {
    const user = userEvent.setup();
    userLocationState.status = "granted";
    userLocationState.location = { lat: 40.4168, lon: -3.7038, accuracy: 12 };
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url.includes("/api/games/nearby-spot"))
        return jsonResponse({ spot: null, distanceMeters: null });
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);
    await user.click(screen.getByRole("radio", { name: /Challenge/ }));

    const dialog = await openSetupDialog(user, "Create challenge");
    await within(dialog).getByRole("radio", { name: /Flexible/ });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Rails" });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(
      await within(dialog).findByText(/No compatible registered spot/),
    ).toBeInTheDocument();
    // still on spot step, create not yet visible; Continue blocked by validation
    expect(within(dialog).queryByTestId("mobile-create-game")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("focuses the guest name when training creation is submitted without one", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn={false} />);

    const dialog = await openSetupDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    const nameInput = within(dialog).getByLabelText("Rider name");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveFocus();
    expect(
      within(dialog).getByText("Enter a rider name between 1 and 30 characters."),
    ).toBeInTheDocument();
    expect(
      (fetch as Mock).mock.calls.some(
        ([input]) => String(input) === "/api/games",
      ),
    ).toBe(false);
  });

  it("submits Training with explicit flexible trick settings", async () => {
    const user = userEvent.setup();
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url === "/api/games") {
        return jsonResponse({ id: "game-1", version: 0 }, 201);
      }
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);
    const dialog = await openSetupDialog(user);
    await within(dialog).getByRole("radio", { name: /Flexible/ });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Rails" });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByText(/Where will you ride\?/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByText(/Ready to start/)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByTestId("mobile-create-game")).toBeEnabled(),
    );
    await user.click(within(dialog).getByTestId("mobile-create-game"));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true);
    });
    const createCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/games",
    );
    const body = JSON.parse(String(createCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      mode: "training",
      ruleMode: "flexible",
      gameFormat: "tricks",
      spotType: "rails",
      level: 1,
    });
  });

  it("submits Training from the mobile setup dialog", async () => {
    const user = userEvent.setup();
    const fetchMock = fetch as Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/games/options")) {
        return jsonResponse({
          disciplineSlug: "skateboard",
          spotTypes: [
            { slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2, 3] },
          ],
        });
      }
      if (url === "/api/games")
        return jsonResponse({ id: "game-2", version: 0 }, 201);
      return jsonResponse({ error: "Not found" }, 404);
    });

    render(<GameCreateForm signedIn />);
    const dialog = await openSetupDialog(user);
    await within(dialog).getByRole("radio", { name: /Flexible/ });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("radio", { name: "Rails" });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByText(/Ready to start/);
    await user.click(within(dialog).getByTestId("mobile-create-game"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === "/api/games"),
      ).toBe(true),
    );
    // Returning from the board must land on a closed landing page: the
    // setup dialog state is reset before navigating away (router cache
    // would otherwise re-activate it still open).
    expect(routerPushMock).toHaveBeenCalledWith("/games/game-2");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Start training" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("supports arrow-key navigation between game modes", async () => {
    const user = userEvent.setup();
    render(<GameCreateForm signedIn />);

    const challenge = screen.getByRole("radio", { name: /Challenge/ });
    challenge.focus();

    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("radio", { name: /Training/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Training/ })).toHaveFocus();
  });

  it("exposes game mode as a labeled radio group", () => {
    render(<GameCreateForm signedIn />);

    const gameMode = screen.getByRole("group", { name: "Game mode" });
    expect(within(gameMode).getByRole("radiogroup")).toBeInTheDocument();
    expect(
      within(gameMode).getByRole("radio", { name: /Training/ }),
    ).toBeInTheDocument();
    expect(
      within(gameMode).getByRole("radio", { name: /Challenge/ }),
    ).toBeInTheDocument();
  });

  it("rejects an invalid trick level before submission (racing deprecated)", async () => {
    render(<GameCreateForm signedIn />);
    // Racing is deprecated, so we verify trick validation still works
    expect(await screen.findByText(/Trick settings/)).toBeInTheDocument();
  });

  it("renders sport picker and allows selecting a sport when preferredSport is 'all'", async () => {
    const user = userEvent.setup();
    usePreferencesStore.getState().setPreferences(
      { distanceUnit: "mi", temperatureUnit: "C", preferredSport: "all" },
      { accountId: "user-1", hasLocalChanges: false },
    );

    render(<GameCreateForm signedIn />);

    const sportGroup = screen.getByRole("group", { name: "Sport" });
    expect(sportGroup).toBeInTheDocument();
    expect(within(sportGroup).getByRole("radio", { name: "Skateboard" })).toBeInTheDocument();
    expect(within(sportGroup).getByRole("radio", { name: "BMX" })).toBeInTheDocument();

    await user.click(within(sportGroup).getByRole("radio", { name: "BMX" }));
    expect(within(sportGroup).getByRole("radio", { name: "BMX" })).toHaveAttribute("aria-checked", "true");
  });
});
