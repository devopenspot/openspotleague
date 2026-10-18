import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, beforeEach } from "vitest"
import type { GameState } from "@/lib/schemas/game"
import { ChallengeRiderTracksSheet } from "@/components/games/board/ChallengeRiderTracksSheet"

const game = {
  mode: "challenge",
  viewerPlayerId: "player-1",
  viewerPoints: 13,
  currentChallengerPlayerId: "player-1",
  winnerPlayerId: null,
  players: [
    { id: "player-1", displayName: "Rider", letters: "", status: "active" },
    { id: "player-2", displayName: "Guest", letters: "B", status: "active" },
  ],
  wordLength: 4,
  eliminationWord: "BIKE",
  stageLedger: [
    {
      id: "round-1",
      scores: [{ playerId: "player-1", points: 13 }],
    },
  ],
} as unknown as GameState

beforeEach(() => {
  document.body.style.overflow = ""
})

describe("ChallengeRiderTracksSheet", () => {
  it("provides a keyboard alternative to the touch gesture", async () => {
    const user = userEvent.setup()
    render(<ChallengeRiderTracksSheet game={game} />)

    const trigger = screen.getByRole("button", { name: "Expand Crew Board — See Who’s Riding" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(trigger)

    const dialog = await screen.findByRole("dialog", { name: "Crew Board" })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("button", { name: "Collapse Crew Board" })).toHaveFocus()
    expect(screen.getByText("Rider")).toBeInTheDocument()
    expect(document.body.style.overflow).toBe("hidden")
  })

  it("collapses from Escape and restores focus to the sheet trigger", async () => {
    const user = userEvent.setup()
    render(<ChallengeRiderTracksSheet game={game} />)

    const trigger = screen.getByRole("button", { name: "Expand Crew Board — See Who’s Riding" })
    await user.click(trigger)
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Expand Crew Board — See Who’s Riding" })).toHaveFocus()
    expect(document.body.style.overflow).toBe("")
  })

  it("collapses from the backdrop", async () => {
    const user = userEvent.setup()
    render(<ChallengeRiderTracksSheet game={game} />)

    await user.click(screen.getByRole("button", { name: "Expand Crew Board — See Who’s Riding" }))
    await user.click(screen.getByTestId("challenge-rider-tracks-backdrop"))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
