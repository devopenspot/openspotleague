import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getGameCreationOptionsMock = vi.fn()

vi.mock("@/lib/services/games", () => ({
  getGameCreationOptions: (...args: unknown[]) => getGameCreationOptionsMock(...args),
}))

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from "./route"

const sample = {
  disciplineSlug: "roller",
  spotTypes: [{ slug: "rails", name: "Rails", sortOrder: 1, levels: [1, 2] }],
  categories: [] as string[],
  tricks: [] as unknown[],
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/games/options", () => {
  it("returns catalog-compatible spot types and levels", async () => {
    getGameCreationOptionsMock.mockResolvedValue(sample)

    const response = await GET(
      new NextRequest("http://localhost/api/games/options?disciplineSlug=roller"),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(sample)
    expect(getGameCreationOptionsMock).toHaveBeenCalledWith("roller")
  })

  it("rejects a missing discipline", async () => {
    const response = await GET(new NextRequest("http://localhost/api/games/options"))

    expect(response.status).toBe(400)
    expect(getGameCreationOptionsMock).not.toHaveBeenCalled()
  })

  it("returns 500 when options cannot be loaded", async () => {
    getGameCreationOptionsMock.mockRejectedValue(new Error("db down"))

    const response = await GET(
      new NextRequest("http://localhost/api/games/options?disciplineSlug=roller"),
    )

    expect(response.status).toBe(500)
  })
})
