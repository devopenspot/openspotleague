import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { FlagState } from "@/lib/services/flags/feature-flags"
import { FlagManager } from "./FlagManager"

const flag: FlagState = {
  key: "bigFeature",
  description: "A big feature",
  owner: "devopenspot",
  removeBy: "2099-01-01",
  defaultEnabled: false,
  override: null,
}

afterEach(() => vi.unstubAllGlobals())

describe("FlagManager", () => {
  it("explains how to add a flag when none are declared", () => {
    render(<FlagManager initialFlags={[]} />)
    expect(screen.getByText(/No feature flags are declared/)).toBeInTheDocument()
  })

  it("saves an admins-only override", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: "2026-11-12T00:00:00.000Z" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    render(<FlagManager initialFlags={[flag]} />)
    expect(screen.getByText("Default: off")).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole("combobox"), "on")
    await userEvent.click(screen.getByRole("checkbox", { name: "Admins only" }))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"))
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("/api/admin/flags/bigFeature")
    expect(JSON.parse(init.body)).toEqual({ enabled: true, rolloutPercent: 0, allowUserIds: [], allowRoles: ["admin"] })
    expect(screen.getByText(/On for roles admin/)).toBeInTheDocument()
  })

  it("resets to the code default with DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    const withOverride: FlagState = {
      ...flag,
      override: { enabled: false, rolloutPercent: 100, allowUserIds: [], allowRoles: [], updatedBy: null, updatedAt: "2026-11-12T00:00:00.000Z" },
    }
    render(<FlagManager initialFlags={[withOverride]} />)
    await userEvent.selectOptions(screen.getByRole("combobox"), "default")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/flags/bigFeature", { method: "DELETE" }))
    expect(screen.getByText("Default: off")).toBeInTheDocument()
  })
})
