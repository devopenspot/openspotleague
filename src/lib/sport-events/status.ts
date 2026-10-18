import type { SportEvent, SportEventStatus } from "@/types/sport-events"

/**
 * Event dates are calendar dates, not user-local instants. They are stored as
 * UTC timestamps so the database can compare them consistently; all status
 * boundaries therefore use UTC midnight and UTC end-of-day.
 */
function toUTCDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function endOfDayUTC(iso: string): Date {
  return new Date(`${iso}T23:59:59Z`);
}

export function deriveStatus(event: SportEvent, now: Date): SportEventStatus {
  const start = toUTCDate(event.startDate);
  const end = event.endDate ? endOfDayUTC(event.endDate) : endOfDayUTC(event.startDate);
  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "live";
}
