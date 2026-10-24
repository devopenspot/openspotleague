import { z } from "zod";
import rbacRaw from "@/data/rbac.json";

export interface PermissionSeedEntry {
  slug: string;
  name: string;
  description: string;
}

export interface RoleSeedEntry {
  slug: string;
  name: string;
  description: string;
  permissions: readonly string[];
}

const PermissionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
});

const RoleSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  permissions: z.array(z.string().min(1)),
});

const RbacSchema = z.object({
  permissions: z.array(PermissionSchema),
  roles: z.array(RoleSchema),
});

const parsed = RbacSchema.parse(rbacRaw);

export const PERMISSION_SEED: readonly PermissionSeedEntry[] = parsed.permissions;
export const ROLE_SEED: readonly RoleSeedEntry[] = parsed.roles;

export const ADMIN_PERMISSION_SLUGS: readonly string[] =
  parsed.roles.find((r) => r.slug === "admin")?.permissions ?? [];

export const CURATOR_PERMISSION_SLUGS: readonly string[] =
  parsed.roles.find((r) => r.slug === "curator")?.permissions ?? [];

export const SPOT_CURATOR_PERMISSION_SLUGS: readonly string[] =
  parsed.roles.find((r) => r.slug === "spot_curator")?.permissions ?? [];

export const EVENT_CURATOR_PERMISSION_SLUGS: readonly string[] =
  parsed.roles.find((r) => r.slug === "event_curator")?.permissions ?? [];

export const TRICK_CURATOR_PERMISSION_SLUGS: readonly string[] =
  parsed.roles.find((r) => r.slug === "trick_curator")?.permissions ?? [];
