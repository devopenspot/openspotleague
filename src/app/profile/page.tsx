import { connection } from "next/server"
import { ProfileClient } from "@/components/profile/ProfileClient"
import { ProfileUnavailable } from "@/components/profile/layout/ProfileUnavailable"
import { parseProfileTab } from "@/components/profile/tabs/profile-tabs"
import { requireUserOrRedirect } from "@/lib/auth/server"
import { getProfileSummary } from "@/lib/services/profile/profile"
import { withSafeDefaultResult } from "@/lib/utils/safe-fetch"

export const metadata = {
  title: "Profile",
  description: "Your activity, spots, tricks and preferences on Open Spot.",
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const user = await requireUserOrRedirect("/profile")
  const [{ value: summary }, params] = await Promise.all([
    withSafeDefaultResult(() => getProfileSummary(user.id), null, "profile.summary"),
    searchParams,
  ])
  if (!summary) return <ProfileUnavailable />
  return <ProfileClient summary={summary} initialTab={parseProfileTab(params.tab)} />
}
