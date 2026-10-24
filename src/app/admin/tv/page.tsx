import { connection } from "next/server";
import { requireTvCurationRoleOrRedirect } from "@/lib/auth/server";
import { runListTvVideos, listTvDistinctCategories } from "@/lib/services/tv/tv";
import { listSports } from "@/lib/services/taxonomy/taxonomy";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { TvAdminClient } from "@/components/tv/form/TvAdminClient";
import type { TvVideo } from "@/types/tv";

export const metadata = {
  title: "Admin · TV",
};

interface AdminTvPageProps {
  searchParams: Promise<{
    discipline?: string;
    category?: string;
  }>;
}

export default async function AdminTvPage({ searchParams }: AdminTvPageProps) {
  await connection();
  const user = await requireTvCurationRoleOrRedirect("/admin/tv");
  const { getAuthorizationSnapshotCached } = await import(
    "@/lib/services/profile/authorization"
  );

  let allowedDisciplines: string[] | undefined;
  try {
    const snapshot = await getAuthorizationSnapshotCached(user.id);
    const isAdminLike = snapshot.roles.has("admin") || snapshot.roles.has("curator");
    if (!isAdminLike) {
      allowedDisciplines = Array.from(snapshot.disciplineScopes);
    }
  } catch {
    allowedDisciplines = [];
  }

  const params = await searchParams;
  const rawDiscipline = params.discipline?.trim().toLowerCase();
  const selectedCategory = params.category?.trim().toLowerCase();

  // If user has scoped curator access, enforce discipline scope constraint
  const selectedDiscipline =
    rawDiscipline && (!allowedDisciplines || allowedDisciplines.includes(rawDiscipline))
      ? rawDiscipline
      : undefined;

  // Zero-query default: do NOT load videos unless a discipline is actively selected
  const EMPTY_VIDEOS: readonly TvVideo[] = [];
  const EMPTY_CATEGORIES: readonly string[] = [];
  const [videos, disciplines, availableCategories] = await Promise.all([
    selectedDiscipline
      ? withSafeDefault(
          () =>
            runListTvVideos({
              disciplineSlug: selectedDiscipline,
              category: selectedCategory,
              limit: 100,
            }),
          EMPTY_VIDEOS,
          "adminTvPage-runListTvVideos",
        )
      : Promise.resolve(EMPTY_VIDEOS),
    withSafeDefault(
      () => listSports(),
      [] as readonly { slug: string; name: string }[],
      "adminTvPage-listSports",
    ),
    selectedDiscipline
      ? withSafeDefault(
          () => listTvDistinctCategories({ disciplineSlug: selectedDiscipline }),
          EMPTY_CATEGORIES,
          "adminTvPage-listTvDistinctCategories",
        )
      : Promise.resolve(EMPTY_CATEGORIES),
  ]);

  const normalized = disciplines.map((d) => ({
    slug: d.slug,
    name: d.name ?? d.slug,
  }));

  return (
    <TvAdminClient
      initialVideos={videos}
      disciplines={normalized}
      selectedDiscipline={selectedDiscipline}
      selectedCategory={selectedCategory}
      availableCategories={availableCategories}
    />
  );
}
