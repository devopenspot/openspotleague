import { Suspense } from "react";
import { SportEventsTab } from "@/components/sport-events/layout/SportEventsTab";
import { EventSkeleton } from "@/components/sport-events/cards/EventSkeleton";
import { listEventDirectory } from "@/lib/services/event/events";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

export const metadata = {
  title: "Sport Events",
  description:
    "The official circuit for action sports: Street League, FISE, Winterclash, X Games, and the World Skate Games. Live, upcoming, and past events in one place.",
};

async function SportEventsContent() {
  const { events, featured } = await withSafeDefault(
    () => listEventDirectory(),
    { events: [], featured: undefined },
    "listEventDirectory",
  );
  return <SportEventsTab featured={featured} events={events} />;
}

export default function SportEventsPage() {
  return (
    <Suspense
      fallback={<EventSkeleton />}
    >
      <SportEventsContent />
    </Suspense>
  );
}
