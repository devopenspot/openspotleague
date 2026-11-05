import type { ReactNode } from "react";
import { ContestCard } from "@/components/league/landing/ContestCard";
import { ContestEmptyState } from "@/components/league/landing/ContestEmptyState";
import { ContestFeaturedHero } from "@/components/league/landing/ContestFeaturedHero";
import { EYEBROW_ON_GRADIENT, SECTION_TITLE } from "@/components/ui/recipes";
import type { ContestEnriched, ContestStatus } from "@/types/league";

interface ContestDirectoryProps {
  featured: ContestEnriched | undefined;
  /** Already filtered and ordered; excludes the featured contest. */
  events: readonly ContestEnriched[];
  status: "all" | ContestStatus;
}

const UPCOMING_TITLE: Record<"all" | ContestStatus, string> = {
  all: "Live & upcoming",
  live: "Live now",
  upcoming: "Upcoming",
  completed: "Live & upcoming",
};

export function ContestDirectory({
  featured,
  events,
  status,
}: ContestDirectoryProps) {
  const active = events.filter((event) => event.status !== "completed");
  const past = events.filter((event) => event.status === "completed");
  const nothing = !featured && events.length === 0;

  return (
    <>
      {featured ? (
        <DirectorySection
          id="featured-contest-section"
          title="Featured"
          eyebrow="Public contest"
        >
          <ContestFeaturedHero event={featured} />
        </DirectorySection>
      ) : null}

      {nothing ? <ContestEmptyState status={status} /> : null}

      {active.length > 0 ? (
        <DirectorySection
          id="contests-grid-section"
          title={UPCOMING_TITLE[status]}
          eyebrow={`${active.length} ${active.length === 1 ? "contest" : "contests"}`}
        >
          <div
            id="contests-grid"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {active.map((event, index) => (
              <ContestCard key={event.id} event={event} priority={index === 0} />
            ))}
          </div>
        </DirectorySection>
      ) : null}

      {past.length > 0 ? (
        <DirectorySection
          id="past-contests-section"
          title="Past contests"
          eyebrow="Results and archives"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {past.map((event) => (
              <ContestCard key={event.id} event={event} variant="compact" />
            ))}
          </div>
        </DirectorySection>
      ) : null}

    </>
  );
}

function DirectorySection({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="space-y-4">
      <div>
        <p className={EYEBROW_ON_GRADIENT}>{eyebrow}</p>
        <h2
          id={headingId}
          className={`mt-1 ${SECTION_TITLE} text-on-gradient`}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
