import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProfileSpotsGrid } from "./ProfileSpotsGrid"
import type { Spot } from "@/lib/types"

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

function spotFixture(id: string, name: string): Spot {
  return {
    id,
    slug: id,
    name,
    city: "Madrid",
    citySlug: "madrid",
    address: null,
    types: [{ slug: "skate", name: "Skate" }],
    sports: [],
    image: null,
    country: "Spain",
    countryCode: "ES",
    location: { lat: 40.4, lon: -3.7 },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    createdBy: null,
  } as unknown as Spot
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ProfileSpotsGrid", () => {
  it("discards the stale response when the kind switches before it resolves", async () => {
    const staleSaved = deferred<Response>()
    const verified = deferred<Response>()
    fetchMock.mockImplementationOnce(() => staleSaved.promise)
    fetchMock.mockImplementationOnce(() => verified.promise)

    render(<ProfileSpotsGrid />)
    await userEvent.click(screen.getByRole("button", { name: /verified/i }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![0] as string).toContain("kind=verified")

    staleSaved.resolve(jsonResponse({ items: [spotFixture("s1", "STALE SPOT")], nextCursor: null }))
    verified.resolve(
      jsonResponse({
        items: [spotFixture("v1", "VERIFIED ONE"), spotFixture("v2", "VERIFIED TWO")],
        nextCursor: null,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText("VERIFIED ONE")).toBeInTheDocument()
      expect(screen.getByText("VERIFIED TWO")).toBeInTheDocument()
    })
    expect(screen.queryByText("STALE SPOT")).not.toBeInTheDocument()
  })

  it("keeps appended results when load more resolves after mount load", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse({ items: [spotFixture("s1", "SAVED ONE")], nextCursor: "c1" }),
      ),
    )
    render(<ProfileSpotsGrid />)
    await waitFor(() => expect(screen.getByText("SAVED ONE")).toBeInTheDocument())

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse({ items: [spotFixture("s2", "SAVED TWO")], nextCursor: null }),
      ),
    )
    await userEvent.click(screen.getByRole("button", { name: /load more/i }))

    await waitFor(() => expect(screen.getByText("SAVED TWO")).toBeInTheDocument())
    expect(screen.getByText("SAVED ONE")).toBeInTheDocument()
    expect(fetchMock.mock.calls[1]![0] as string).toContain("cursor=c1")
  })
})
