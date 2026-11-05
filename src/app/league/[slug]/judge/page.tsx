import { redirect } from "next/navigation";
import { buildContestJudgeUrl } from "@/lib/league/urls";

/** Old judge-queue URL: judging now lives in the contest hub. */
export default async function JudgePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(buildContestJudgeUrl(slug));
}
