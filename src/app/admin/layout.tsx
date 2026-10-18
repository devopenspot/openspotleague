import type { Metadata } from "next"
import { connection } from "next/server"
import { requireAdminOrRedirect } from "@/lib/auth/server"
import { AdminShell } from "@/components/admin/AdminShell"
import "./admin.css"

export const metadata: Metadata = {
  title: "Admin",
  description: "Manage skate spots and sport events.",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  // Intentionally curation-gated: any curator role (spot/event/trick/tv/curator) may
  // access /admin. Sub-pages / taxonomy & settings re-gate to admin via
  // requireAdministratorOrRedirect. Do not tighten this to admin-only.
  await requireAdminOrRedirect("/admin")
  return (
    <div className="admin-route-scope">
      <AdminShell>{children}</AdminShell>
    </div>
  )
}
