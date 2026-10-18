import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SpotTypesSection } from "./SpotTypesSection"

const showToastMock = vi.fn()
vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}))

const spotTypes = [
  { slug: "rails", name: "Rails", sortOrder: 0 },
  { slug: "ledges", name: "Ledges", sortOrder: 1 },
]

describe("SpotTypesSection", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ slug: "new", name: "New", sortOrder: 2 }),
        headers: new Headers(),
      }) as unknown as Response,
    )
  })

  it("renders spot types", () => {
    render(<SpotTypesSection spotTypes={spotTypes} />)
    expect(screen.getByDisplayValue("Rails")).toBeInTheDocument()
    expect(screen.getByText("rails")).toBeInTheDocument()
  })

  it("adds a new spot type", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ slug: "stairs", name: "Stairs", sortOrder: 2 }),
        headers: new Headers(),
      }) as unknown as Response,
    )
    globalThis.fetch = fetchMock

    render(<SpotTypesSection spotTypes={spotTypes} />)

    await user.type(screen.getByLabelText("New spot type slug"), "stairs")
    await user.type(screen.getByLabelText("New spot type name"), "Stairs")
    await user.click(screen.getByRole("button", { name: "Add" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/spot-types",
      expect.objectContaining({ method: "POST" }),
    )
    expect(await screen.findByDisplayValue("Stairs")).toBeInTheDocument()
  })

  it("saves an existing spot type", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      }) as unknown as Response,
    )
    globalThis.fetch = fetchMock

    render(<SpotTypesSection spotTypes={spotTypes} />)
    await user.clear(screen.getByLabelText("rails name"))
    await user.type(screen.getByLabelText("rails name"), "Rail")
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]!)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/spot-types/rails",
      expect.objectContaining({ method: "PATCH" }),
    )
  })
})
