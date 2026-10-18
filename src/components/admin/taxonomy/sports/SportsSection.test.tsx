import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SportsSection } from "./SportsSection"

const showToastMock = vi.fn()
vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}))

const sports = [
  { slug: "skateboard", name: "Skateboard", sortOrder: 0 },
  { slug: "bmx", name: "BMX", sortOrder: 1 },
]

describe("SportsSection", () => {
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

  it("renders sports rows", () => {
    render(<SportsSection sports={sports} />)
    expect(screen.getByDisplayValue("Skateboard")).toBeInTheDocument()
    expect(screen.getByDisplayValue("BMX")).toBeInTheDocument()
  })

  it("saves a sport", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({}),
        headers: new Headers(),
      }) as unknown as Response,
    )
    globalThis.fetch = fetchMock

    render(<SportsSection sports={sports} />)

    const input = screen.getByLabelText("skateboard name")
    await user.clear(input)
    await user.type(input, "Skate")
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]!)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/sports/skateboard",
      expect.objectContaining({ method: "PATCH" }),
    )
    const [, opts] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(JSON.parse(String(opts!.body))).toEqual({ name: "Skate", sortOrder: 0 })
  })

  it("opens delete confirmation", async () => {
    const user = userEvent.setup()
    render(<SportsSection sports={sports} />)

    await user.click(screen.getByLabelText("Delete Skateboard"))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText(/Delete "Skateboard"/)).toBeInTheDocument()
  })
})
