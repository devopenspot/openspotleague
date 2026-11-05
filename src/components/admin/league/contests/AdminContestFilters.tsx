import { Search } from "lucide-react"
import type { LeaguePlanItem } from "@/lib/services/league"

export interface AdminContestFilterValues {
  q?: string
  plan?: string
  visibility?: string
  status?: string
  featured?: string
}

const STATUS_OPTIONS = [
  ["draft", "Draft"],
  ["registration_open", "Registration open"],
  ["registration_closed", "Registration closed"],
  ["scheduled", "Scheduled"],
  ["live", "Live"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const

const LABEL_CLASS =
  "mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
const FIELD_CLASS =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-base font-medium text-on-surface focus:border-primary focus:outline-none sm:text-sm"

/** GET form: filters live in the URL, so the page works without JS. */
export function AdminContestFilters({
  values,
  plans,
}: {
  values: AdminContestFilterValues
  plans: readonly LeaguePlanItem[]
}) {
  return (
    <form
      method="get"
      role="search"
      aria-label="Filter contests"
      className="grid grid-cols-1 gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 md:grid-cols-[minmax(0,1fr)_9rem_9rem_11rem_8rem_auto] md:items-end"
    >
      <div>
        <label htmlFor="contests-q" className={LABEL_CLASS}>
          Search
        </label>
        <div className="relative">
          <Search
            size={12}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
          />
          <input
            id="contests-q"
            name="q"
            type="search"
            defaultValue={values.q ?? ""}
            placeholder="Contest name…"
            className={`${FIELD_CLASS} pl-8`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="contests-plan" className={LABEL_CLASS}>
          Plan
        </label>
        <select id="contests-plan" name="plan" defaultValue={values.plan ?? ""} className={FIELD_CLASS}>
          <option value="">Any</option>
          {plans.map((plan) => (
            <option key={plan.slug} value={plan.slug}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contests-visibility" className={LABEL_CLASS}>
          Listing
        </label>
        <select
          id="contests-visibility"
          name="visibility"
          defaultValue={values.visibility ?? ""}
          className={FIELD_CLASS}
        >
          <option value="">Any</option>
          <option value="public">Public</option>
          <option value="unlisted">Private</option>
        </select>
      </div>
      <div>
        <label htmlFor="contests-status" className={LABEL_CLASS}>
          Status
        </label>
        <select id="contests-status" name="status" defaultValue={values.status ?? ""} className={FIELD_CLASS}>
          <option value="">Any</option>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contests-featured" className={LABEL_CLASS}>
          Featured
        </label>
        <select
          id="contests-featured"
          name="featured"
          defaultValue={values.featured ?? ""}
          className={FIELD_CLASS}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface hover:bg-surface-container-highest"
      >
        Apply
      </button>
    </form>
  )
}
