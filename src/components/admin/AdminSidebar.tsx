"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  ClipboardList,
  FileVideo,
  Globe,
  MapPin,
  Tags,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useUser } from "@/lib/contexts/user-context"
import { cn } from "@/lib/utils/cn"

interface SidebarItem {
  href: string
  label: string
  Icon: LucideIcon
  exact?: boolean
  adminOnly?: boolean
}

const CURATION_ITEMS: readonly SidebarItem[] = [
  { href: "/admin/curation", label: "Overview", Icon: ClipboardList },
  { href: "/admin/spots", label: "Spots", Icon: MapPin },
  { href: "/admin/events", label: "Events", Icon: CalendarDays },
  { href: "/admin/taxonomy/tricks", label: "Tricks", Icon: Trophy },
  { href: "/admin/tv", label: "TV", Icon: FileVideo },
]

const ADMIN_ITEMS: readonly SidebarItem[] = [
  {
    href: "/admin/taxonomy/sports",
    label: "Sports",
    Icon: Tags,
    adminOnly: true,
  },
  {
    href: "/admin/taxonomy/spot-types",
    label: "Spot types",
    Icon: Tags,
    adminOnly: true,
  },
  {
    href: "/admin/taxonomy/regions",
    label: "Regions & Countries",
    Icon: Globe,
    adminOnly: true,
  },
  {
    href: "/admin/users",
    label: "Users & roles",
    Icon: Users,
    adminOnly: true,
  },
]

function isActive(pathname: string, item: SidebarItem): boolean {
  if (item.href === "/admin/curation") {
    return pathname === "/admin" || pathname === item.href
  }
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function SidebarLink({ pathname, item }: { pathname: string; item: SidebarItem }) {
  const active = isActive(pathname, item)
  const Icon = item.Icon
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-full border border-transparent px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.99]",
          active
            ? "border-primary bg-surface-container text-on-surface"
            : "border-transparent text-secondary hover:bg-surface-container-low hover:text-on-surface",
        )}
      >
        <Icon size={14} aria-hidden="true" />
        {item.label}
      </Link>
    </li>
  )
}

function SidebarGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: readonly SidebarItem[]
  pathname: string
}) {
  return (
    <div className="space-y-2">
      <span className="block px-3 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
        {label}
      </span>
      <ul className="space-y-1">
        {items.map((item) => (
          <SidebarLink key={item.href} pathname={pathname} item={item} />
        ))}
      </ul>
    </div>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const user = useUser()
  if (!user?.canCurate) return null
  const items = user?.isAdministrator ? ADMIN_ITEMS : []
  // Filter curation items by scoped roles; legacy curator sees all.
  const curationItems = CURATION_ITEMS.filter((item) => {
    if (!user) return false
    if (user.isAdministrator) return true
    // Fallback: use explicit booleans if present
    if (item.href === "/admin/spots") return Boolean(user.canCurateSpots ?? true)
    if (item.href === "/admin/events") return Boolean(user.canCurateEvents ?? true)
    if (item.href === "/admin/taxonomy/tricks") return Boolean(user.canCurateTricks ?? true)
    if (item.href === "/admin/tv") return Boolean((user as unknown as { canCurateTv?: boolean }).canCurateTv ?? true)
    return true // Overview visible to any curator
  })

  return (
    <aside aria-label="Admin navigation" className="w-full shrink-0 md:w-56">
      <nav aria-label="Admin sections" className="space-y-5">
        <SidebarGroup label="Curation" items={curationItems} pathname={pathname} />
        {items.length > 0 ? (
          <SidebarGroup label="Administration" items={items} pathname={pathname} />
        ) : null}
      </nav>
    </aside>
  )
}
