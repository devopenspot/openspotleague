import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ResponsibilityPolicyModal } from "./ResponsibilityPolicyModal"

describe("ResponsibilityPolicyModal", () => {
  it("links to the risk section of the terms", () => {
    render(<ResponsibilityPolicyModal isOpen onClose={() => {}} />)

    expect(screen.getByRole("dialog", { name: "Ride at your own risk" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Read the terms" })).toHaveAttribute(
      "href",
      "/terms#risk-waiver",
    )
  })

  it("closes from Got it", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ResponsibilityPolicyModal isOpen onClose={onClose} />)

    await user.click(screen.getByRole("button", { name: "Got it" }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
