import { describe, expect, it } from "vitest"
import { resolveGameDiscipline } from "@/lib/games/discipline"

describe("game discipline preference gate", () => {
  it("resolves exactly one compatible sport", () => {
    expect(resolveGameDiscipline("Scooter")).toBe("scooter")
    expect(resolveGameDiscipline("BMX")).toBe("bmx")
  })

  it("blocks an unset sport preference", () => {
    expect(resolveGameDiscipline(null)).toBeNull()
  })

  it("returns null when preference is 'all'", () => {
    expect(resolveGameDiscipline("all")).toBeNull()
  })
})
