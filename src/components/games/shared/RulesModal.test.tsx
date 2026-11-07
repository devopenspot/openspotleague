import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { LEVEL_POINTS, WINNER_BONUS_POINTS } from "@/lib/games/definitions"
import { RulesModal } from "./RulesModal"

describe("RulesModal", () => {
  it("names the rider's own word and the battle points", () => {
    render(<RulesModal isOpen onClose={() => {}} eliminationWord="SKATE" />)

    const dialog = screen.getByRole("dialog", { name: "Game of SKATE" })
    expect(dialog).toHaveTextContent("Spell SKATE and you're out.")
    expect(screen.getByRole("img", { name: "Example: 2 of 5 letters" })).toBeInTheDocument()
    const points = Object.values(LEVEL_POINTS)
    expect(dialog).toHaveTextContent(
      `${Math.min(...points)}–${Math.max(...points)} points by level, plus ${WINNER_BONUS_POINTS} for the win`,
    )
  })

  it("lists every word when no sport is picked", () => {
    render(<RulesModal isOpen onClose={() => {}} />)

    expect(screen.getByRole("dialog", { name: "The game" })).toHaveTextContent(
      "BLADE, SKATE, BIKE or SCOOT",
    )
  })

  it("closes from the close button, Got it and Escape", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RulesModal isOpen onClose={onClose} eliminationWord="BIKE" />)

    await user.click(screen.getByRole("button", { name: "Close game rules" }))
    await user.click(screen.getByRole("button", { name: "Got it" }))
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
