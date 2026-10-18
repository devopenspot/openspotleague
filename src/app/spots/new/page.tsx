import { requireUserOrRedirect } from "@/lib/auth/server";
import SpotCreateForm from "@/components/spots/create/SpotCreateForm";

export const metadata = {
  title: "Add Spot",
  description: "Add a new spot from your current location. Personal until verified by the community.",
};

export default async function NewSpotPage() {
  await requireUserOrRedirect("/spots/new");
  return <SpotCreateForm />;
}
