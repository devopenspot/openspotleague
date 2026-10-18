import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSessionUserMock, redirectMock, resolveGameIdByShareCodeMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  redirectMock: vi.fn(),
  resolveGameIdByShareCodeMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirectMock(destination),
}))

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: () => getSessionUserMock(),
}))

vi.mock("@/lib/services/games", () => ({
  resolveGameIdByShareCode: (...args: unknown[]) => resolveGameIdByShareCodeMock(...args),
}))

import JoinGamePage from "./page"

beforeEach(() => {
  vi.resetAllMocks()
  getSessionUserMock.mockResolvedValue(null)
})

describe("JoinGamePage", () => {
  it("renders a crawlable sign-in gate for anonymous challenge invites", async () => {
    resolveGameIdByShareCodeMock.mockResolvedValue({ id: "game-1", mode: "challenge" })

    const page = await JoinGamePage({
      params: Promise.resolve({ shareCode: "CHALLENGE123" }),
    })
    render(page)

    expect(screen.getByRole("heading", { name: "Sign in to ride" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in to join" })).toHaveAttribute(
      "href",
      "/login?next=%2Fgames%2Fgame-1%3Fshare%3DCHALLENGE123",
    )
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("keeps anonymous training invites on the game redirect", async () => {
    resolveGameIdByShareCodeMock.mockResolvedValue({ id: "game-1", mode: "training" })

    await JoinGamePage({
      params: Promise.resolve({ shareCode: "TRAIN123" }),
    })

    expect(redirectMock).toHaveBeenCalledWith("/games/game-1?share=TRAIN123")
  })

  it("keeps authenticated challenge invites on the game redirect", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })
    resolveGameIdByShareCodeMock.mockResolvedValue({ id: "game-1", mode: "challenge" })

    await JoinGamePage({
      params: Promise.resolve({ shareCode: "CHALLENGE123" }),
    })

    expect(redirectMock).toHaveBeenCalledWith("/games/game-1?share=CHALLENGE123")
  })
})
