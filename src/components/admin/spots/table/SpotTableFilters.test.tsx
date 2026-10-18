import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SpotTableFilters } from "./SpotTableFilters"

const router = vi.hoisted(() => ({ replace: vi.fn() }))
const url = vi.hoisted(() => ({ value: new URLSearchParams() }))

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/spots",
  useRouter: () => router,
  useSearchParams: () => url.value,
}))

vi.mock("@/stores/spots-store", () => ({
  useSpotsStore: (selector: (state: unknown) => unknown) =>
    selector({
      spotTypes: [
        { slug: "rails", name: "Rails" },
        { slug: "ledges", name: "Ledges" },
      ],
    }),
}))

describe("SpotTableFilters", () => {
  it("keeps the sport filter in the URL", async () => {
    const user = userEvent.setup()
    render(
      <SpotTableFilters
        sportOptions={[
          { value: "Skateboard", label: "Skateboard" },
          { value: "BMX", label: "BMX" },
        ]}
      />,
    )

    await user.selectOptions(screen.getByLabelText("Sport"), "BMX")

    expect(router.replace).toHaveBeenLastCalledWith(
      "/admin/spots?sport=BMX",
      { scroll: false },
    )
  })
})
