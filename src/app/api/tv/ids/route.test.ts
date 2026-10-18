import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const listTvIdListMock = vi.fn()

vi.mock("@/lib/services/tv/tv", () => ({
  listTvIdList: (...args: unknown[]) => listTvIdListMock(...args),
}))

import { GET } from "./route"

beforeEach(() => {
  vi.resetAllMocks()
})

describe("GET /api/tv/ids", () => {
  it("returns ordered ids with a total for the filter", async () => {
    listTvIdListMock.mockResolvedValue(["v1", "v2"])
    const res = await GET(
      new NextRequest("http://localhost/api/tv/ids?discipline=roller&category=music"),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ids: ["v1", "v2"], total: 2 })
    expect(listTvIdListMock).toHaveBeenCalledWith({
      disciplineSlug: "roller",
      category: "music",
      publishedOnly: true,
    })
  })
})
