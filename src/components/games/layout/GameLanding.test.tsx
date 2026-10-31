import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/games",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/components/games/create/GameCreateForm", () => ({
  GameCreateForm: () => (
    <section aria-label="Game setup">
      <button role="radio" aria-checked="true">Training</button>
      <button role="radio" aria-checked="false">Challenge</button>
    </section>
  ),
}))

vi.mock("@/components/games/shared/RulesModal", () => ({
  RulesModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Game rules modal" /> : null,
}))
vi.mock("@/components/games/shared/ResponsibilityPolicyModal", () => ({
  ResponsibilityPolicyModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Rider policy modal" /> : null,
}))
vi.mock("@/components/games/matches/MatchesDrawer", () => ({ MatchesDrawer: () => null }))
vi.mock("@/components/games/board/RiderActivityBoard", () => ({
  RiderActivityBoard: () => null,
  useRiderActivity: () => ({ days: [], error: false }),
}))

import { GameLanding } from "@/components/games/layout/GameLanding"
import { usePreferencesStore } from "@/stores/preferences-store"
import { useUIStore } from "@/stores/ui-store"

describe("GameLanding", () => {
  beforeEach(() => {
    pushMock.mockReset()
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))))
    usePreferencesStore.getState().setPreferences(
      { distanceUnit: "km", temperatureUnit: "C", preferredSport: "Skateboard" },
      { accountId: "user-1", hasLocalChanges: false },
    )
    usePreferencesStore.getState().setHydrationStatus("ready")
    useUIStore.getState().closeOnboarding()
  })

  it("puts game setup ahead of joining and exposes a top join trigger", () => {
    render(<GameLanding signedIn={false} />)

    expect(screen.getByRole("heading", { name: /Set up your game/i })).toBeInTheDocument()
    expect(screen.getByTestId("join-game-trigger")).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("heading", { name: "Have a share code?" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Training" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Challenge" })).toBeInTheDocument()
  })

  it("routes a valid share code to the join page", async () => {
    const user = userEvent.setup()
    render(<GameLanding signedIn={false} />)

    const trigger = screen.getByTestId("join-game-trigger")
    await user.click(trigger)

    const dialog = await screen.findByRole("dialog", { name: "Have a share code?" })
    const input = within(dialog).getByLabelText("Enter a game share code")
    expect(input).toHaveAttribute("aria-describedby", "join-game-description")
    await user.type(input, "ABC123")
    await user.click(within(dialog).getByRole("button", { name: "Join" }))

    expect(pushMock).toHaveBeenCalledWith("/games/join/ABC123")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Have a share code?" })).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })

  it("keeps the join drawer open and reports an empty share code", async () => {
    const user = userEvent.setup()
    render(<GameLanding signedIn={false} />)

    await user.click(screen.getByTestId("join-game-trigger"))
    const dialog = await screen.findByRole("dialog", { name: "Have a share code?" })
    const input = within(dialog).getByLabelText("Enter a game share code")

    await user.click(within(dialog).getByRole("button", { name: "Join" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a share code to join a game.")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAttribute(
      "aria-describedby",
      "join-game-description share-code-error",
    )
    expect(screen.getByRole("dialog", { name: "Have a share code?" })).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("opens the signed-in rider record in a drawer across viewports", async () => {
    const user = userEvent.setup()
    render(<GameLanding signedIn />)

    const trigger = screen.getByRole("button", { name: "record" })
    expect(trigger).toHaveClass("inline-flex")
    expect(trigger).not.toHaveClass("lg:hidden")
    await user.click(trigger)

    const dialog = await screen.findByRole("dialog", { name: "record" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(
      within(dialog).getByRole("button", { name: "View your matches" }),
    ).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "record" })).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })

  it("exposes a direct matches trigger for signed-in riders", () => {
    render(<GameLanding signedIn />)

    const matchesButton = screen.getByRole("button", { name: "Matches" })
    expect(matchesButton).toBeInTheDocument()
    expect(matchesButton).toHaveAttribute("aria-controls", "matches-drawer")
  })

  it("renders active and recent matches section when signed in", () => {
    render(<GameLanding signedIn />)

    expect(
      screen.getByRole("heading", { name: "Active & Recent" }),
    ).toBeInTheDocument()
  })

  it("does not render active and recent matches section when signed out", () => {
    render(<GameLanding signedIn={false} />)

    expect(
      screen.queryByRole("heading", { name: "Active & Recent" }),
    ).not.toBeInTheDocument()
  })

  it("exposes game rules and rider policy modal triggers from LandingInfo", async () => {
    const user = userEvent.setup()
    render(<GameLanding signedIn={false} />)

    const footer = screen.getByRole("contentinfo", { name: "Game information and rules" })
    expect(footer).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Game rules" }))
    expect(screen.getByRole("dialog", { name: "Game rules modal" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Rider policy" }))
    expect(screen.getByRole("dialog", { name: "Rider policy modal" })).toBeInTheDocument()
  })

  it("keeps a hydrated guest sport when opening the game challenge", async () => {
    usePreferencesStore.getState().setPreferences(
      { distanceUnit: "km", temperatureUnit: "C", preferredSport: "BMX" },
      { accountId: null, hasLocalChanges: true },
    )
    usePreferencesStore.getState().setHydrationStatus("ready")

    render(<GameLanding signedIn={false} />)

    await waitFor(() =>
      expect(useUIStore.getState().isOnboardingOpen).toBe(false),
    )
    expect(screen.getByRole("heading", { name: /Set up your game/i })).toBeInTheDocument()
  })

  it("does not pop open preferences when user has chosen 'all' disciplines as default", async () => {
    usePreferencesStore.getState().setPreferences(
      { distanceUnit: "mi", temperatureUnit: "C", preferredSport: "all" },
      { accountId: "user-1", hasLocalChanges: false },
    )
    usePreferencesStore.getState().setHydrationStatus("ready")

    render(<GameLanding signedIn={false} />)

    expect(useUIStore.getState().isOnboardingOpen).toBe(false)
    expect(
      screen.getByText(/All disciplines selected/i),
    ).toBeInTheDocument()
  })
})
