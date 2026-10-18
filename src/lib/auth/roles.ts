export const ROLE_SLUGS = ["admin", "curator", "spot_curator", "event_curator", "trick_curator", "tv_curator"] as const
export type RoleSlug = (typeof ROLE_SLUGS)[number]

// Backward compat: legacy generic curator (deprecated, maps to all scoped curators)
export const LEGACY_CURATOR_ROLE: RoleSlug = "curator"
export const SCOPED_CURATOR_ROLES: readonly RoleSlug[] = ["spot_curator", "event_curator", "trick_curator", "tv_curator"] as const
export type ScopedCuratorRole = (typeof SCOPED_CURATOR_ROLES)[number]
