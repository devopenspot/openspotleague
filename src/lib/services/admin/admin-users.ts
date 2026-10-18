import "server-only"

import {
  getAdminUserRepositoryAsync,
  type AdminUserListCursor,
  type AdminUserListOptions,
  type AdminUserListResult,
} from "@/lib/repositories"
import type { RoleSlug } from "@/lib/services/profile/authorization"

export interface ListAdminUsersOptions {
  q?: string
  role?: RoleSlug
  limit?: number
  cursor?: AdminUserListCursor | null
}

export async function runListAdminUsers(
  options: ListAdminUsersOptions = {},
): Promise<AdminUserListResult> {
  const repositoryOptions: AdminUserListOptions = {
    q: options.q,
    role: options.role,
    limit: options.limit,
    cursor: options.cursor,
  }
  return (await getAdminUserRepositoryAsync()).list(repositoryOptions)
}
