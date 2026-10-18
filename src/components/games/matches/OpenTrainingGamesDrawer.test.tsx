import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/games",
}))

import { OpenTrainingGamesDrawer } from "./OpenTrainingGamesDrawer"

const game = {
  id: "game-1",
  version: 4,
  status: "lobby",
  mode: "training",
  disciplineSlug: "skateboard",
  gameName: "Play a Skate",
  nextSpotType: "flatground",
  updatedAt: "2026-08-08T12:00:00.000Z",
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([game])))
})

describe("OpenTrainingGamesDrawer", () => {
  it("loads a game with resume and cancel actions", async () => {
    render(<OpenTrainingGamesDrawer isOpen onClose={vi.fn()} authenticated />)

    expect(await screen.findByText("Play a Skate")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /resume/i })).toHaveAttribute("href", "/games/game-1")
    expect(screen.getByRole("button", { name: /finish run/i })).toBeInTheDocument()
  })

  it("confirms cancellation and removes the game", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<OpenTrainingGamesDrawer isOpen onClose={onClose} authenticated />)
    await screen.findByText("Play a Skate")

    await user.click(screen.getByRole("button", { name: /finish run/i }))
    expect(screen.getByText(/finish this run/i)).toBeInTheDocument()
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: game.id, version: 5, status: "cancelled" }))
    await user.click(screen.getByRole("button", { name: /yes, finish run/i }))

    await waitFor(() => expect(screen.queryByText("Play a Skate")).not.toBeInTheDocument())
    const cancelCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/games/game-1/cancel")
    expect(cancelCall?.[1]).toEqual(expect.objectContaining({ method: "POST" }))
    expect(JSON.parse(String(cancelCall?.[1] && (cancelCall[1] as RequestInit).body))).toEqual(expect.objectContaining({ expectedVersion: 4, idempotencyKey: expect.any(String) }))
  })

  it("sends the guest token when managing a guest game", async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, "localStorage", { value: { getItem: () => "guest-token-12345678901234567890" }, configurable: true })
    render(<OpenTrainingGamesDrawer isOpen onClose={vi.fn()} authenticated={false} />)
    await screen.findByText("Play a Skate")
    await user.click(screen.getByRole("button", { name: /finish run/i }))
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: game.id, version: 5, status: "cancelled" }))
    await user.click(screen.getByRole("button", { name: /yes, finish run/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/games/game-1/cancel", expect.objectContaining({
      headers: expect.objectContaining({ "x-guest-token": "guest-token-12345678901234567890" }),
    })))
  })

  it("shows an educational empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])))
    render(<OpenTrainingGamesDrawer isOpen onClose={vi.fn()} authenticated />)

    expect(await screen.findByText("No open training games")).toBeInTheDocument()
    expect(within(screen.getByRole("dialog")).getByText(/next training challenge/i)).toBeInTheDocument()
  })
})
