import { ProfileClient } from "@/components/profile/ProfileClient"
import { requireUserOrRedirect } from "@/lib/auth/server"

export const metadata = {
  title: "Profile",
  description: "Your activity, spots, tricks and preferences on Open Spot.",
}

export default async function ProfilePage() {
  await requireUserOrRedirect("/profile")
  return <ProfileClient />
}
