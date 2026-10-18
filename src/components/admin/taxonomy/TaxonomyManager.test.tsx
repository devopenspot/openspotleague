import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TaxonomyManager } from "./TaxonomyManager"

const showToastMock = vi.fn()

vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}))

const spotTypes = [
  { slug: "rails", name: "Rails", sortOrder: 0 },
  { slug: "ledges", name: "Ledges", sortOrder: 1 },
]

const catalogs = [
  {
    disciplineSlug: "skateboard",
    challengeKey: "skate",
    gameName: "Play a Skate",
    eliminationWord: "SKATE",
    createdAt: "2026-01-01T00:00:00.000Z",
    tricks: [
      {
        sourceId: "boardslide",
        name: "Boardslide",
        description: "Slide the board across the rail.",
        level: 1 as const,
        compatibleSpotTypes: ["rails"],
        categories: [],
      },
      {
        sourceId: "kickflip",
        name: "Kickflip",
        description: "Flip the board while jumping.",
        level: 2 as const,
        compatibleSpotTypes: ["ledges"],
        categories: [],
      },
    ],
  },
]

const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => ({
    ok: true,
    status: options?.method === "DELETE" ? 204 : 200,
    json: async () => options?.method === "PUT" ? JSON.parse(String(options.body)) : {},
  }))
  window.confirm = vi.fn(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderTricks() {
  return render(
    <TaxonomyManager
      section="tricks"
      sports={[]}
      spotTypes={spotTypes}
      catalogs={catalogs}
    />,
  )
}

async function selectSport(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole("combobox"), "skateboard")
}

describe("TaxonomyManager trick actions", () => {
  it("saves only the edited trick row", async () => {
    const user = userEvent.setup()
    renderTricks()
    await selectSport(user)

    await user.click(screen.getAllByRole("button", { name: "Ledges" })[0]!)
    await user.click(screen.getByRole("button", { name: "Save Boardslide" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/admin/trick-catalogs/skateboard/tricks/boardslide")
    expect(options.method).toBe("PUT")
    expect(JSON.parse(String(options.body))).toEqual({
      sourceId: "boardslide",
      name: "Boardslide",
      description: "Slide the board across the rail.",
      level: 1,
      compatibleSpotTypes: ["rails", "ledges"],
      categories: [],
    })
  })

  it("creates a new trick when its row is saved", async () => {
    const user = userEvent.setup()
    renderTricks()
    await selectSport(user)

    await user.click(screen.getByRole("button", { name: "Add trick" }))
    await user.click(screen.getAllByRole("button", { name: "Ledges" })[2]!)
    await user.click(screen.getByRole("button", { name: "Save New trick" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/^\/api\/admin\/trick-catalogs\/skateboard\/tricks\/admin-/)
    expect(options.method).toBe("PUT")
    expect(JSON.parse(String(options.body))).toEqual(expect.objectContaining({
      name: "New trick",
      description: "Describe the trick.",
      level: 1,
      compatibleSpotTypes: ["ledges"],
      categories: [],
    }))
  })

  it("deletes a persisted trick row", async () => {
    const user = userEvent.setup()
    renderTricks()
    await selectSport(user)

    await user.click(screen.getByRole("button", { name: "Delete Boardslide" }))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirm" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/admin/trick-catalogs/skateboard/tricks/boardslide")
    expect(options.method).toBe("DELETE")
    expect(screen.queryByDisplayValue("Boardslide")).not.toBeInTheDocument()
  })

  it("discards an unsaved new trick without a request", async () => {
    const user = userEvent.setup()
    renderTricks()
    await selectSport(user)

    await user.click(screen.getByRole("button", { name: "Add trick" }))
    await user.click(screen.getByRole("button", { name: "Delete New trick" }))
    await user.click(screen.getByRole("button", { name: "Confirm" }))

    expect(fetchMock).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByDisplayValue("New trick")).not.toBeInTheDocument()
    })
  })
})
