// Domain barrel: auth & authorization tables.
// Re-exports auth-related tables from the canonical index. Physical table
// definitions remain in index.ts to avoid circular FK dependencies; this
// barrel provides domain-grouped entry point for future consumers.
// Preferred import: `from "@/db/schema/auth"` for auth tables.
export {
  authSchema,
  authUsers,
  profiles,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  curatorCountryScopes,
  curatorDisciplineScopes,
  contentAuditLog,
  authUsersRelations,
  profilesRelations,
} from "./index";

export type {
  GamePlayerIdSnapshot,
  GameRotationOrder,
} from "./index";
