import { redirect } from "next/navigation";
import { buildContestManageUrl } from "@/lib/league/urls";

/** Old organizer-console URL: the tools now live in the contest hub. */
export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(buildContestManageUrl(slug));
}
