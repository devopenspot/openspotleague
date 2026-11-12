import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FlagOverride } from "@/lib/flags/definition"
import type { FeatureFlagRepository } from "@/lib/repositories/flags/feature-flag-repository"

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }))

vi.mock("@/lib/flags/registry", () => ({
  FLAGS: {
    bigFeature: {
      description: "A big feature",
      owner: "devopenspot",
      removeBy: "2099-01-01",
      defaults: { local: true, develop: true, production: false },
    },
  },
}))

vi.mock("@/lib/config/env", () => ({ env: { APP_ENV: "production" } }))

const repo: FeatureFlagRepository = {
  listOverrides: vi.fn(),
  upsertOverride: vi.fn(),
  deleteOverride: vi.fn(),
}
vi.mock("@/lib/repositories", () => ({ getFeatureFlagRepositoryAsync: () => Promise.resolve(repo) }))

const snapshot = vi.fn()
vi.mock("@/lib/services/profile/authorization", () => ({
  getAuthorizationSnapshotCached: (userId: string) => snapshot(userId),
}))

const queueTagRevalidate = vi.fn()
vi.mock("@/lib/cache/deferred", () => ({
  queueTagRevalidate: (...args: unknown[]) => queueTagRevalidate(...args),
  runWithDeferredCacheInvalidation: <T,>(fn: () => Promise<T>) => fn(),
}))

const { FEATURE_FLAG_CACHE_LIFE } = await import("@/lib/cache/lifetimes")
const service = await import("./feature-flags")
const isEnabled = service.isEnabled as unknown as (key: string, subject?: object) => Promise<boolean>

function row(patch: Partial<FlagOverride> = {}): FlagOverride {
  return {
    key: "bigFeature",
    enabled: true,
    rolloutPercent: 0,
    allowUserIds: [],
    allowRoles: [],
    updatedBy: null,
    updatedAt: new Date("2026-11-12T00:00:00Z"),
    ...patch,
  }
}

describe("feature flag service", () => {
  beforeEach(() => {
    service.resetFeatureFlagReadStateForTests()
    vi.mocked(repo.listOverrides).mockReset().mockResolvedValue([])
    snapshot.mockReset()
  })

  it("uses the production default without an override", async () => {
    expect(await isEnabled("bigFeature")).toBe(false)
  })

  it("falls back to the defaults when the read fails, and backs off", async () => {
    vi.mocked(repo.listOverrides).mockRejectedValueOnce(new Error("db down"))
    expect(await isEnabled("bigFeature", { userId: "u1" })).toBe(false)
    expect(await isEnabled("bigFeature", { userId: "u1" })).toBe(false)
    expect(repo.listOverrides).toHaveBeenCalledTimes(1)
  })

  it("keeps the last good overrides while backing off", async () => {
    vi.mocked(repo.listOverrides).mockResolvedValueOnce([row({ rolloutPercent: 100 })])
    expect(await isEnabled("bigFeature", { userId: "u1" })).toBe(true)
    vi.mocked(repo.listOverrides).mockRejectedValueOnce(new Error("db down"))
    expect(await isEnabled("bigFeature", { userId: "u1" })).toBe(true)
  })

  it("loads roles only when an override targets roles", async () => {
    vi.mocked(repo.listOverrides).mockResolvedValue([row({ allowRoles: ["admin"] })])
    snapshot.mockResolvedValue({ roles: new Set(["admin"]) })
    expect(await isEnabled("bigFeature", { userId: "u1" })).toBe(true)
    expect(snapshot).toHaveBeenCalledWith("u1")

    snapshot.mockClear()
    vi.mocked(repo.listOverrides).mockResolvedValue([row({ rolloutPercent: 100 })])
    expect(await isEnabled("bigFeature", { userId: "u1" })).toBe(true)
    expect(snapshot).not.toHaveBeenCalled()
  })

  it("lists declared flags with the environment default and override", async () => {
    vi.mocked(repo.listOverrides).mockResolvedValue([row({ enabled: false })])
    const [state] = await service.listFlagStates()
    expect(state).toMatchObject({ key: "bigFeature", defaultEnabled: false, override: { enabled: false } })
  })

  it("rejects unknown flags and bad percentages", async () => {
    const input = { enabled: true, rolloutPercent: 10, allowUserIds: [], allowRoles: [] }
    await expect(service.setFlagOverride("nope", input, "admin-1")).rejects.toMatchObject({ code: "UNKNOWN_FLAG" })
    await expect(service.setFlagOverride("bigFeature", { ...input, rolloutPercent: 101 }, "admin-1")).rejects.toMatchObject({
      code: "INVALID_OVERRIDE",
    })
    expect(repo.upsertOverride).not.toHaveBeenCalled()
  })

  it("saves an override and invalidates with the shared profile object", async () => {
    vi.mocked(repo.upsertOverride).mockResolvedValue(row({ rolloutPercent: 10 }))
    await service.setFlagOverride("bigFeature", { enabled: true, rolloutPercent: 10, allowUserIds: [], allowRoles: [] }, "admin-1")
    expect(repo.upsertOverride).toHaveBeenCalledWith(expect.objectContaining({ key: "bigFeature", updatedBy: "admin-1" }))
    expect(queueTagRevalidate).toHaveBeenCalledWith(service.FEATURE_FLAGS_TAG, FEATURE_FLAG_CACHE_LIFE)
  })
})
