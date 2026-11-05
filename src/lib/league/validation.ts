const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidEventDateRange(
  startDate: string,
  endDate?: string | null,
): boolean {
  return endDate === undefined || endDate === null || endDate >= startDate;
}

export function assertValidEventDateRange(
  startDate: string,
  endDate?: string | null,
): void {
  if (!isValidEventDateRange(startDate, endDate)) {
    throw new Error("Event end date must be on or after the start date");
  }
}

export function normalizeCitySlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
