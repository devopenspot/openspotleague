"use client";

/**
 * League event create flow (2-month advance window, free plan by default).
 * Mirrors the admin event form's control language; submission posts to
 * `/api/league/events` with a UUID idempotency key in the body (league
 * convention — one key per submit attempt, so a retried POST replays
 * instead of creating a second event) and redirects to the organizer console.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  CountrySelection,
} from "@/components/admin/spots/form/CountryAutocomplete";
import { CountryAutocomplete } from "@/components/admin/spots/form/CountryAutocomplete";
import { DateField } from "@/components/admin/events/form/DateField";
import { SportDisciplineSchema, SportEventCategorySchema } from "@/lib/schemas/event";
import type { SportEventCategory } from "@/types/sport-events";
import { leagueCreateEventInputSchema } from "@/lib/schemas/league";
import type { LeagueCreateEventResponse } from "@/lib/schemas/league";

const CONTROL_CLASSES =
  "w-full rounded-md border border-outline-variant bg-surface-bright p-3 text-base sm:text-sm font-medium text-on-surface shadow-none transition-colors focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2";

const CATEGORY_OPTIONS: { value: SportEventCategory; label: string }[] =
  SportEventCategorySchema.options.map((value) => ({
    value,
    label: value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));

const DISCIPLINE_OPTIONS = [...SportDisciplineSchema.options];

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  error,
  hint,
  autoComplete,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  autoComplete?: string;
  min?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
      >
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        min={min}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(CONTROL_CLASSES, error && "border-error")}
      />
      {hint ? (
        <p id={hintId} className="mt-1 text-xs leading-5 text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
      <legend className="flex items-center gap-2 px-1 font-display text-sm font-bold tracking-[0.05em] text-on-surface">
        <Icon size={16} aria-hidden="true" />
        {title}
      </legend>
      <p className="mb-5 max-w-2xl text-xs leading-5 text-secondary">{intro}</p>
      {children}
    </fieldset>
  );
}

export function LeagueCreateForm({ organizerName }: { organizerName?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [sports, setSports] = useState<(typeof DISCIPLINE_OPTIONS)[number][]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [country, setCountry] = useState<CountrySelection>({
    name: "",
    code: "",
  });
  const [timezone, setTimezone] = useState("UTC");
  const [category, setCategory] =
    useState<SportEventCategory>("local-event");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const maxStartDate = useMemo(() => {
    const max = new Date();
    max.setUTCMonth(max.getUTCMonth() + 2);
    return max.toISOString().slice(0, 10);
  }, []);

  function toggleSport(value: (typeof DISCIPLINE_OPTIONS)[number]) {
    setSports((current) =>
      current.includes(value)
        ? current.filter((currentValue) => currentValue !== value)
        : [...current, value],
    );
  }

  function validate(): boolean {
    const parsed = leagueCreateEventInputSchema.safeParse({
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      description,
      sports,
      startDate,
      endDate: endDate || undefined,
      city: city.trim(),
      country: country.name.trim(),
      countryCode: country.code.trim() || undefined,
      venue: venue.trim() || undefined,
      timezone: timezone.trim() || "UTC",
      category,
    });
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return false;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) {
      const firstInvalid = document.querySelector<HTMLElement>(
        "[aria-invalid='true']",
      );
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      // ui.spec: focus moves to the first error, not just the scroll.
      firstInvalid?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/league/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          name: name.trim(),
          shortName: shortName.trim() || undefined,
          description: description,
          sports,
          startDate,
          endDate: endDate || undefined,
          city: city.trim(),
          country: country.name.trim(),
          countryCode: country.code.trim() || undefined,
          venue: venue.trim() || undefined,
          timezone: timezone.trim() || "UTC",
          category,
        }),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setSubmitError(raw?.message ?? raw?.error ?? "Event could not be created.");
        return;
      }
      const data = raw as LeagueCreateEventResponse;
      router.push(`/sport-events/${data.slug}/manage`);
    } catch {
      setSubmitError(
        "Event could not be created. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
            League
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-on-surface">
            Create a sport event
          </h1>
          {organizerName ? (
            <p className="mt-1 text-sm text-secondary">
              You&apos;ll be the main organizer, {organizerName} — you judge
              implicitly.
            </p>
          ) : null}
        </div>
        <p className="rounded-full border border-outline-variant bg-surface-container-high px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
          Free plan · up to 3 riders
        </p>
      </div>

      <Section
        icon={Trophy}
        title="Event essentials"
        intro="Name your competition and describe it for riders who join from the share link."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id="league-name"
            label="Event name"
            value={name}
            onChange={setName}
            placeholder="e.g. Riverside Night Jam"
            required
            error={errors.name}
            autoComplete="off"
          />
          <Field
            id="league-short-name"
            label="Short name"
            value={shortName}
            onChange={setShortName}
            placeholder="e.g. RNJ26"
            error={errors.shortName}
            autoComplete="off"
          />
          <div className="sm:col-span-2">
            <label
              htmlFor="league-description"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Description
            </label>
            <textarea
              id="league-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should riders and judges expect?"
              aria-invalid={errors.description ? true : undefined}
              className={cn(CONTROL_CLASSES, "resize-y", errors.description && "border-error")}
            />
            {errors.description ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {errors.description}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-semibold tracking-[0.05em] text-secondary">
              Disciplines <span aria-hidden="true">*</span>
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Event disciplines">
              {DISCIPLINE_OPTIONS.map((value) => {
                const active = sports.includes(value);
                return (
                  <li key={value}>
                    <label
                      className={cn(
                        "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 py-2 text-xs font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant bg-surface-bright text-on-surface hover:border-outline",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleSport(value)}
                        className="sr-only"
                        aria-label={value}
                      />
                      {value}
                    </label>
                  </li>
                );
              })}
            </ul>
            {errors.sports ? (
              <p role="alert" className="mt-2 text-xs text-error">
                {errors.sports}
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section
        icon={CalendarClock}
        title="Schedule"
        intro="Community events can be scheduled at most two months ahead. Dates are calendar days; the judging windows are configured per run once the schedule is generated."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <DateField
            id="league-start-date"
            label="Start date"
            value={startDate}
            onChange={setStartDate}
            required
            error={errors.startDate}
            min={new Date().toISOString().slice(0, 10)}
            max={maxStartDate}
            hint="At most 2 months ahead."
          />
          <DateField
            id="league-end-date"
            label="End date"
            value={endDate}
            onChange={setEndDate}
            error={errors.endDate}
            min={startDate || undefined}
            hint="Leave blank for a one-day event. Clear with ✕."
          />
        </div>
        <div className="mt-5">
          <Field
            id="league-timezone"
            label="Timezone"
            value={timezone}
            onChange={(value) => setTimezone(value)}
            placeholder="e.g. Europe/Madrid"
            required
            error={errors.timezone}
            hint="IANA name — used for the live schedule board."
            autoComplete="off"
          />
        </div>
      </Section>

      <Section
        icon={MapPin}
        title="Location"
        intro="Where riders meet. Coordinates are optional for league events — the city and country are what the directory shows."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id="league-city"
            label="City"
            value={city}
            onChange={setCity}
            placeholder="e.g. Barcelona"
            required
            error={errors.city}
            autoComplete="address-level2"
          />
          <div>
            <label
              htmlFor="league-country"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Country <span aria-hidden="true">*</span>
            </label>
            <CountryAutocomplete
              id="league-country"
              value={country}
              onChange={setCountry}
              invalid={Boolean(errors.country)}
            />
            {errors.country ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {errors.country}
              </p>
            ) : null}
          </div>
          <Field
            id="league-venue"
            label="Venue"
            value={venue}
            onChange={setVenue}
            placeholder="e.g. Riverside skatepark"
            error={errors.venue}
          />
          <div>
            <label
              htmlFor="league-category"
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Category <span aria-hidden="true">*</span>
            </label>
            <select
              id="league-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as SportEventCategory)
              }
              className={cn(CONTROL_CLASSES, errors.category && "border-error")}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {submitError ? (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/league")}
          className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface transition-colors hover:border-outline"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-full bg-primary px-6 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create event"}
        </button>
      </div>
    </form>
  );
}
