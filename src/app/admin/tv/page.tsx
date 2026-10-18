import { connection } from "next/server";
import { requireTvCurationRoleOrRedirect } from "@/lib/auth/server";
import { runListTvVideos } from "@/lib/services/tv/tv";
import { listSports } from "@/lib/services/taxonomy/taxonomy";
import { TvAdminClient } from "@/components/tv/form/TvAdminClient";

export const metadata = {
  title: "Admin · TV",
};

export default async function AdminTvPage() {
  await connection();
  const user = await requireTvCurationRoleOrRedirect("/admin/tv");
  const { getAuthorizationSnapshotCached } = await import(
    "@/lib/services/profile/authorization"
  );
  let disciplineSlugs: string[] | undefined;
  try {
    const snapshot = await getAuthorizationSnapshotCached(user.id);
    const isAdminLike = snapshot.roles.has("admin") || snapshot.roles.has("curator");
    if (!isAdminLike) {
      disciplineSlugs = Array.from(snapshot.disciplineScopes);
    }
  } catch {
    disciplineSlugs = [];
  }

  const [videos, disciplines] = await Promise.all([
    runListTvVideos(disciplineSlugs ? { disciplineSlugs } : {}),
    listSports(),
  ]);

  const normalized = (disciplines as readonly { slug: string; name: string }[]).map((d) => ({
    slug: d.slug,
    name: d.name ?? d.slug,
  }));
  return <TvAdminClient initialVideos={videos} disciplines={normalized} />;
}
