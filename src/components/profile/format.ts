/** Display helpers shared by the profile components. Fixed locale so server and client agree. */

const COUNT = new Intl.NumberFormat("en-US");
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatCount(value: number): string {
  return COUNT.format(value);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : SHORT_DATE.format(date);
}

export function plural(value: number, one: string, many = `${one}s`): string {
  return `${formatCount(value)} ${value === 1 ? one : many}`;
}

/** Whole-number percentage, 0 when there is nothing to divide by. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** `skateboard` → `Skateboard`, `bmx` → `BMX`. */
export function disciplineName(slug: string): string {
  if (slug.toLowerCase() === "bmx") return "BMX";
  if (slug.toLowerCase() === "all") return "All sports";
  return slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();
}
