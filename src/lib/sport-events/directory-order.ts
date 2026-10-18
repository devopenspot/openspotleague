import type { SportEventEnriched } from "@/types/sport-events";

const STATUS_ORDER: Record<SportEventEnriched["status"], number> = {
  live: 0,
  upcoming: 1,
  completed: 2,
};

/** Keep active and upcoming events ahead of historical events. */
export function orderEventsForDirectory(
  events: readonly SportEventEnriched[],
): readonly SportEventEnriched[] {
  return [...events].sort(
    (left, right) => {
      const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
      if (statusOrder !== 0) return statusOrder;

      const dateOrder = left.startDate.localeCompare(right.startDate);
      const orderedDate =
        left.status === "completed" ? dateOrder * -1 : dateOrder;
      return orderedDate || left.id.localeCompare(right.id);
    },
  );
}
