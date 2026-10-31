import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadLastSetup, saveLastSetup, type LastSetup } from "@/lib/games/last-setup"

const setup: LastSetup = {
  ruleMode: "strict",
  level: 3,
  spotType: "ledge",
  categories: ["flip"],
}

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("last game setup", () => {
  it("round-trips per discipline", () => {
    saveLastSetup("skateboard", setup)

    expect(loadLastSetup("skateboard")).toEqual(setup)
    expect(loadLastSetup("bmx")).toBeNull()
  })

  it("ignores corrupt or outdated values", () => {
    window.localStorage.setItem("openspot:game-setup:v1:skateboard", "{nope")
    expect(loadLastSetup("skateboard")).toBeNull()

    window.localStorage.setItem(
      "openspot:game-setup:v1:skateboard",
      JSON.stringify({ ...setup, level: 99 }),
    )
    expect(loadLastSetup("skateboard")).toBeNull()
  })

  it("never touches the rider's preferred sport", () => {
    window.localStorage.setItem("openspot-preferences", "untouched")

    saveLastSetup("bmx", setup)

    expect(window.localStorage.getItem("openspot-preferences")).toBe("untouched")
  })

  it("survives storage being unavailable", () => {
    const blocked = () => {
      throw new Error("denied")
    }
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked })

    expect(() => saveLastSetup("bmx", setup)).not.toThrow()
    expect(loadLastSetup("bmx")).toBeNull()

    vi.unstubAllGlobals()
  })
})
