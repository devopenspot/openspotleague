import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GameBoardActionStatusModal } from "./GameBoardActionStatusModal"
import type { GameState } from "@/lib/schemas/game"

const game = {
  gameFormat: "tricks",
  currentRound: { status: "selecting_level" },
} as GameState

describe("GameBoardActionStatusModal", () => {
  it("blocks the board with contextual loading status", () => {
    render(
      <GameBoardActionStatusModal
        isOpen
        busy
        locationPending={false}
        game={game}
      />,
    )

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("heading", { name: "Setting Your Next Trick…" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  })

  it("does not render while no action is in progress", () => {
    render(
      <GameBoardActionStatusModal
        isOpen={false}
        busy
        locationPending={false}
        game={game}
      />,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("stays behind the challenge settings drawer", () => {
    render(
      <GameBoardActionStatusModal
        isOpen
        busy
        locationPending={false}
        settingsModalOpen
        game={game}
      />,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
