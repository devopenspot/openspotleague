import { connection } from "next/server"
import { AdminCurationHub } from "@/components/admin/AdminCurationHub"

export const metadata = {
  title: "Admin · Curation",
}

interface AdminCurationPageProps {
  searchParams: Promise<{ denied?: string }>
}

export default async function AdminCurationPage({
  searchParams,
}: AdminCurationPageProps) {
  await connection()
  const params = await searchParams
  return <AdminCurationHub deniedPath={params.denied} />
}
