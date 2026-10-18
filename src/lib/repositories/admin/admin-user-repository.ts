export interface AdminUserListCursor {
  sortKey: string
  id: string
}

export interface AdminUserListOptions {
  q?: string
  role?: string
  limit?: number
  cursor?: AdminUserListCursor | null
}

export interface AdminUserRoleAssignment {
  slug: string
  name: string
  description?: string
  grantedBy: string | null
  createdAt: string
}

export interface AdminRoleOption {
  slug: string
  name: string
  description: string
}

export interface AdminUserSummary {
  id: string
  displayName: string
  email: string
  createdAt: string | null
  roles: readonly AdminUserRoleAssignment[]
}

export interface AdminUserListResult {
  items: readonly AdminUserSummary[]
  nextCursor: AdminUserListCursor | null
  availableRoles: readonly AdminRoleOption[]
}

export interface AdminUserRepository {
  list(options?: AdminUserListOptions): Promise<AdminUserListResult>
}
