import { describe, expect, it } from "vitest"
import { resolveJoinPath } from "@/lib/games/join-input"

describe("resolveJoinPath", () => {
  it("routes a bare share code, keeping its case", () => {
    expect(resolveJoinPath("  aB3_x-Z9  ")).toBe("/games/join/aB3_x-Z9")
  })

  it("rejects empty input", () => {
    expect(resolveJoinPath("   ")).toBeNull()
  })

  it("accepts a full invite link", () => {
    expect(
      resolveJoinPath("https://openspotleague.com/games/join/aB3_x?utm=1"),
    ).toBe("/games/join/aB3_x")
  })

  it("accepts a relative invite link", () => {
    expect(resolveJoinPath("/games/join/aB3_x#top")).toBe("/games/join/aB3_x")
  })

  it("accepts a short link", () => {
    expect(resolveJoinPath("https://openspotleague.com/s/abc1234")).toBe(
      "/s/abc1234",
    )
  })

  it("never follows a link anywhere else", () => {
    expect(resolveJoinPath("https://evil.example/login")).toBeNull()
    expect(resolveJoinPath("/admin")).toBeNull()
    expect(resolveJoinPath("//evil.example/s/abc")).toBeNull()
    expect(resolveJoinPath("https://")).toBeNull()
  })

  it("only ever uses the path of a foreign link", () => {
    expect(resolveJoinPath("https://evil.example/games/join/x")).toBe(
      "/games/join/x",
    )
  })

  it("encodes odd characters in a typed code", () => {
    expect(resolveJoinPath("a b")).toBe("/games/join/a%20b")
  })
})
