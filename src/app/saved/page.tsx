import SavedTab from "@/components/saved/SavedTab";
import { requireUserOrRedirect } from "@/lib/auth/server";

export const metadata = {
  title: "Saved Spots",
  description: "Your bookmarked skate spots. Sync across sessions.",
};

export default async function SavedPage() {
  await requireUserOrRedirect("/saved");
  return (
    <div className="flex min-h-screen h-auto flex-1 flex-col bg-gradient-to-r from-orange-600 via-red-600 to-red-700">
      <SavedTab />
    </div>
  );
}
