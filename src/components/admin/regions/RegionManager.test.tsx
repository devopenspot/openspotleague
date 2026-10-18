import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type * as PendingActionsModule from "@/hooks/data/usePendingActions"
import { RegionManager } from "./RegionManager"

const showToastMock = vi.fn()
vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}))

const refreshMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock("@/hooks/data/usePendingActions", async () => {
  const actual = (await vi.importActual("@/hooks/data/usePendingActions")) as typeof PendingActionsModule
  return actual
})

const regions = [
  { id: "r1", slug: "europe", name: "Europe", description: "", imageUrl: null, sortOrder: 0, countryCount: 2 },
  { id: "r2", slug: "asia", name: "Asia", description: "", imageUrl: null, sortOrder: 1, countryCount: 1 },
] as const

const countries = [
  { iso2: "DE", name: "Germany", iso3: "DEU", regionId: "r1", regionName: "Europe", spotCount: 3, eventCount: 1 },
  { iso2: "FR", name: "France", iso3: "FRA", regionId: "r1", regionName: "Europe", spotCount: 0, eventCount: 0 },
  { iso2: "JP", name: "Japan", iso3: "JPN", regionId: "r2", regionName: "Asia", spotCount: 5, eventCount: 2 },
] as const

describe("RegionManager", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      }) as unknown as Response,
    )
  })

  it("renders regions by default and switches to countries", async () => {
    const user = userEvent.setup()
    render(<RegionManager initialRegions={[...regions]} initialCountries={[...countries]} />)

    expect(screen.getByDisplayValue("Europe")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Countries/ }))
    expect(screen.getByDisplayValue("Germany")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Japan")).toBeInTheDocument()
  })

  it("filters countries by search query", async () => {
    const user = userEvent.setup()
    render(<RegionManager initialRegions={[...regions]} initialCountries={[...countries]} />)

    await user.click(screen.getByRole("button", { name: /Countries/ }))

    const search = screen.getByLabelText("Search countries")
    await user.type(search, "ger")

    expect(screen.getByDisplayValue("Germany")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("France")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("Japan")).not.toBeInTheDocument()
    expect(screen.getByText(/Showing 1 of 3/)).toBeInTheDocument()
  })

  it("filters countries by region", async () => {
    const user = userEvent.setup()
    render(<RegionManager initialRegions={[...regions]} initialCountries={[...countries]} />)

    await user.click(screen.getByRole("button", { name: /Countries/ }))

    const regionFilter = screen.getByLabelText("Filter countries by region")
    await user.selectOptions(regionFilter, "r1")

    expect(screen.getByDisplayValue("Germany")).toBeInTheDocument()
    expect(screen.getByDisplayValue("France")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("Japan")).not.toBeInTheDocument()
  })

  it("clears filters", async () => {
    const user = userEvent.setup()
    render(<RegionManager initialRegions={[...regions]} initialCountries={[...countries]} />)

    await user.click(screen.getByRole("button", { name: /Countries/ }))
    await user.type(screen.getByLabelText("Search countries"), "jp")
    expect(screen.queryByDisplayValue("Germany")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(screen.getByLabelText("Search countries")).toHaveValue("")
    expect(screen.getByDisplayValue("Germany")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Japan")).toBeInTheDocument()
  })

  it("shows toast when trying to delete region with countries", async () => {
    const user = userEvent.setup()
    render(<RegionManager initialRegions={[...regions]} initialCountries={[...countries]} />)

    // Europe has 2 countries, delete should toast
    const deleteButtons = screen.getAllByLabelText("Delete Europe")
    await user.click(deleteButtons[0]!)

    expect(showToastMock).toHaveBeenCalledWith(expect.stringContaining('Cannot delete "Europe"'), "error")
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
