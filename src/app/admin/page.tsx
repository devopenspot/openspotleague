import { connection } from "next/server"
import { AdminCurationHub } from "@/components/admin/AdminCurationHub"

export const metadata = {
  title: "Admin · Curation",
}

export default async function AdminOverviewPage() {
  await connection()
  return <AdminCurationHub />
}
