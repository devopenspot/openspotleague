import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const readUnsubscribeCategory = vi.fn()
const unsubscribeByToken = vi.fn()

vi.mock("@/lib/notifications/delivery/service", () => ({
  readUnsubscribeCategory: (token: string | null) => readUnsubscribeCategory(token),
  unsubscribeByToken: (token: string | null) => unsubscribeByToken(token),
}))

import { GET, POST } from "./route"

const url = (token?: string) =>
  `https://openspot.example.com/api/notifications/unsubscribe${token ? `?token=${token}` : ""}`

describe("unsubscribe route", () => {
  beforeEach(() => {
    readUnsubscribeCategory.mockReset()
    unsubscribeByToken.mockReset()
  })

  it("GET names the category and changes nothing", async () => {
    readUnsubscribeCategory.mockReturnValue("judging")
    const response = await GET(new NextRequest(url("abc.def")))
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain("Stop judging alerts emails")
    expect(html).toContain('<form method="post"')
    expect(unsubscribeByToken).not.toHaveBeenCalled()
  })

  it("GET rejects a missing or forged token without offering the button", async () => {
    readUnsubscribeCategory.mockReturnValue(null)
    for (const request of [new NextRequest(url()), new NextRequest(url("forged"))]) {
      const response = await GET(request)
      expect(response.status).toBe(400)
      expect(await response.text()).not.toContain("<form")
    }
  })

  it("POST unsubscribes and confirms the category", async () => {
    unsubscribeByToken.mockResolvedValue({ category: "reminders" })
    const response = await POST(new NextRequest(url("abc.def"), { method: "POST" }))
    expect(response.status).toBe(200)
    expect(unsubscribeByToken).toHaveBeenCalledWith("abc.def")
    expect(await response.text()).toContain("reminders emails")
  })

  it("POST rejects a forged token", async () => {
    unsubscribeByToken.mockResolvedValue(null)
    const response = await POST(new NextRequest(url("forged"), { method: "POST" }))
    expect(response.status).toBe(400)
  })
})
