import { describe, expect, it } from "vitest"
import {
  hasCountryScope,
  hasDisciplineScope,
  hasEventCuratorRole,
  hasPermission,
  hasAnyRole,
  hasRole,
  hasSpotCuratorRole,
  hasTrickCuratorRole,
  snapshotFromRows,
} from "./authorization"

const admin = snapshotFromRows([
  { roleSlug: "admin", permissionSlug: "content.read" },
  { roleSlug: "admin", permissionSlug: "content.write" },
  { roleSlug: "admin", permissionSlug: "media.manage" },
  { roleSlug: "admin", permissionSlug: "taxonomy.use" },
  { roleSlug: "admin", permissionSlug: "roles.manage" },
])

const curator = snapshotFromRows([
  { roleSlug: "curator", permissionSlug: "content.read" },
  { roleSlug: "curator", permissionSlug: "content.write" },
  { roleSlug: "curator", permissionSlug: "media.manage" },
  { roleSlug: "curator", permissionSlug: "taxonomy.use" },
])

describe("authorization matrix", () => {
  it("allows an admin to perform unrestricted maintenance", () => {
    expect(hasRole(admin, "admin")).toBe(true)
    expect(hasAnyRole(admin, ["admin", "curator"])).toBe(true)
    expect(hasPermission(admin, ["content.write", "roles.manage"])).toBe(true)
  })

  it("allows curators to manage content and approved taxonomy only", () => {
    expect(hasRole(curator, "curator")).toBe(true)
    expect(hasAnyRole(curator, ["admin", "curator"])).toBe(true)
    expect(hasPermission(curator, ["content.write", "media.manage"])).toBe(true)
    expect(hasPermission(curator, "roles.manage")).toBe(false)
    expect(hasPermission(curator, "database.reset")).toBe(false)
  })

  it("denies authenticated users without an assigned role", () => {
    const authenticated = snapshotFromRows([])
    expect(hasPermission(authenticated, "content.read")).toBe(false)
    expect(hasRole(authenticated, "admin")).toBe(false)
  })

  it("denies anonymous users without a subject snapshot", () => {
    expect(hasPermission(snapshotFromRows([]), "content.read")).toBe(false)
  })

  it("enforces spot curator country scopes", () => {
    const spotCurator = snapshotFromRows(
      [
        { roleSlug: "spot_curator", permissionSlug: "content.read" },
        { roleSlug: "spot_curator", permissionSlug: "content.write" },
      ],
      { countries: ["FR", "US"], disciplines: [] },
    )
    expect(hasSpotCuratorRole(spotCurator)).toBe(true)
    expect(hasEventCuratorRole(spotCurator)).toBe(false)
    expect(hasTrickCuratorRole(spotCurator)).toBe(false)
    expect(hasCountryScope(spotCurator, "FR")).toBe(true)
    expect(hasCountryScope(spotCurator, "fr")).toBe(true) // case-insensitive
    expect(hasCountryScope(spotCurator, "DE")).toBe(false)
    expect(hasDisciplineScope(spotCurator, "skateboard")).toBe(false)
  })

  it("enforces event curator country scopes", () => {
    const eventCurator = snapshotFromRows(
      [{ roleSlug: "event_curator", permissionSlug: "content.write" }],
      { countries: ["DE"], disciplines: [] },
    )
    expect(hasEventCuratorRole(eventCurator)).toBe(true)
    expect(hasSpotCuratorRole(eventCurator)).toBe(false)
    expect(hasCountryScope(eventCurator, "DE")).toBe(true)
    expect(hasCountryScope(eventCurator, "FR")).toBe(false)
  })

  it("enforces trick curator discipline scopes", () => {
    const trickCurator = snapshotFromRows(
      [{ roleSlug: "trick_curator", permissionSlug: "taxonomy.use" }],
      { countries: [], disciplines: ["skateboard", "bmx"] },
    )
    expect(hasTrickCuratorRole(trickCurator)).toBe(true)
    expect(hasDisciplineScope(trickCurator, "skateboard")).toBe(true)
    expect(hasDisciplineScope(trickCurator, "SKATEBOARD")).toBe(true)
    expect(hasDisciplineScope(trickCurator, "roller")).toBe(false)
    expect(hasCountryScope(trickCurator, "FR")).toBe(false)
  })

  it("allows admin to bypass scope checks", () => {
    expect(hasCountryScope(admin, "XX")).toBe(true)
    expect(hasDisciplineScope(admin, "unknown")).toBe(true)
  })

  it("legacy curator bypasses scope for backward compat", () => {
    // Legacy curator without explicit scopes should still pass hasSpotCuratorRole
    expect(hasSpotCuratorRole(curator)).toBe(true)
    // But scope helpers: legacy curator without scopes would still be checked via hasRole(curator) bypass in require* functions.
    // Snapshot without scopes: hasCountryScope without admin/curator bypass would be false, but service bypasses for legacy curator.
    const noScope = snapshotFromRows([{ roleSlug: "curator", permissionSlug: "content.write" }], { countries: [], disciplines: [] })
    expect(hasCountryScope(noScope, "FR")).toBe(false) // raw helper false, but requireSpotCurationForUser bypasses
  })
})
