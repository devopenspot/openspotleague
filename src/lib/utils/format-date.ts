const UTC_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
})

export function formatUtcDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : UTC_DATE_FORMATTER.format(date)
}
