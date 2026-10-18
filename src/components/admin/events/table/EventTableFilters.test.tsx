import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { EventTableFilters } from "./EventTableFilters"

const router = vi.hoisted(() => ({ replace: vi.fn() }))
const url = vi.hoisted(() => ({ value: new URLSearchParams() }))

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/events",
  useRouter: () => router,
  useSearchParams: () => url.value,
}))

describe("EventTableFilters", () => {
  it("serializes sport, date, category, and featured filters", async () => {
    const user = userEvent.setup()
    render(
      <EventTableFilters
        sportOptions={[{ value: "BMX", label: "BMX" }]}
        categoryOptions={[{ value: "festival", label: "Festival" }]}
      />,
    )

    await user.selectOptions(screen.getByLabelText("Sport"), "BMX")
    await user.selectOptions(screen.getByLabelText("Tier"), "festival")
    await user.type(screen.getByLabelText("Starts on or after"), "2026-08-01")
    await user.click(screen.getByLabelText("Featured only"))

    expect(router.replace).toHaveBeenLastCalledWith(
      "/admin/events?category=festival&discipline=BMX&from=2026-08-01&featured=true",
      { scroll: false },
    )
  })
})
