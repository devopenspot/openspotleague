import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ChallengeSettingsModal } from "@/components/games/shared/ChallengeSettingsModal"

vi.mock("next/navigation", () => ({
  usePathname: () => "/games/game-1",
}))

describe("ChallengeSettingsModal", () => {
  it("submits the selected spot and level as one settings payload", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ChallengeSettingsModal
        isOpen
        onClose={vi.fn()}
        spotTypes={[
          { slug: "rails", name: "Rails", sortOrder: 1 },
          { slug: "bowl", name: "Bowl", sortOrder: 2 },
        ]}
        initialSpotType="rails"
        initialLevel={1}
        liveChallenge={false}
        busy={false}
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole("radio", { name: "Bowl" }))
    await user.click(screen.getByRole("radio", { name: /Advanced Level 3/ }))
    await user.click(screen.getByRole("button", { name: "Lock It In" }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith({ spotType: "bowl", level: 3 })
  })

  it("uses flexible-round copy when changing the next challenge", () => {
    render(
      <ChallengeSettingsModal
        isOpen
        onClose={vi.fn()}
        spotTypes={[{ slug: "rails", name: "Rails", sortOrder: 1 }]}
        initialSpotType="rails"
        initialLevel={2}
        liveChallenge
        busy={false}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText("Switch It Up")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Next Trick" })).toBeInTheDocument()
  })
})
