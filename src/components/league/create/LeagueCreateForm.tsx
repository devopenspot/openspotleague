"use client";

/**
 * Contest create flow (2-month advance window, free plan by default).
 * Built on the league form parts (shared recipes); submission posts to
 * `/api/league/events` with a UUID idempotency key in the body (league
 * convention — one key per submit attempt, so a retried POST replays
 * instead of creating a second event) and redirects to the organizer console.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { ArrowLeft, CalendarClock, Link2, MapPin, Trophy } from "lucide-react";
import type { CountrySelection } from "@/components/admin/spots/form/CountryAutocomplete";
import { CountryAutocomplete } from "@/components/admin/spots/form/CountryAutocomplete";
import { DateField } from "@/components/league/DateField";
import { ContestCoverField } from "@/components/league/cover/ContestCoverField";
import { uploadContestCover } from "@/components/league/cover/upload-contest-cover";
import {
  FieldLabel,
  FieldMessages,
  FormSection,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/league/form-parts";
import {
  BODY,
  EYEBROW,
  PAGE_TITLE,
  alertClass,
  chipClass,
  controlClass,
  tagClass,
} from "@/components/ui/recipes";
import { SportDisciplineSchema, SportEventCategorySchema } from "@/lib/schemas/event";
import type { ContestCategory } from "@/types/league";
import { leagueCreateEventInputSchema } from "@/lib/schemas/league";
import type { LeagueCreateEventResponse } from "@/lib/schemas/league";
import { buildContestManageUrl } from "@/lib/league/urls";
import { ROUTES } from "@/lib/navigation/nav";

const CATEGORY_OPTIONS: { value: ContestCategory; label: string }[] =
  SportEventCategorySchema.options.map((value) => ({
    value,
    label: value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));

const DISCIPLINE_OPTIONS = [...SportDisciplineSchema.options];

const noopSubscribe = () => () => {};

/** The browser's IANA zone, or UTC when it can't be read. */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
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
  const [officialUrl, setOfficialUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [country, setCountry] = useState<CountrySelection>({
    name: "",
    code: "",
  });
  // Organizer's own zone once hydrated (the server snapshot is UTC); a typed
  // value wins over the detected one.
  const detectedTimezone = useSyncExternalStore(
    noopSubscribe,
    browserTimezone,
    () => "UTC",
  );
  const [timezoneInput, setTimezone] = useState<string | null>(null);
  const timezone = timezoneInput ?? detectedTimezone;
  const [category, setCategory] =
    useState<ContestCategory>("local-event");
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

  function payload() {
    return {
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
      url: officialUrl.trim() || undefined,
      instagram: instagram.trim() || undefined,
      youtube: youtube.trim() || undefined,
    };
  }

  function validate(): boolean {
    const parsed = leagueCreateEventInputSchema.safeParse(payload());
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
    // Commit the error state now so the focus step below finds the
    // aria-invalid fields on this submit, not the next one.
    flushSync(() => setErrors(fieldErrors));
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
          ...payload(),
        }),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setSubmitError(raw?.message ?? raw?.error ?? "Contest could not be created.");
        return;
      }
      const data = raw as LeagueCreateEventResponse;
      const manageUrl = buildContestManageUrl(data.slug);
      if (coverFile) {
        // The contest exists now; a failed cover upload must not block the
        // organizer — the console offers the upload again.
        const uploaded = await uploadContestCover({
          eventId: data.id,
          file: coverFile,
          expectedVersion: data.version,
        }).catch(() => null);
        if (!uploaded?.ok) {
          router.push(`${manageUrl}?cover=failed`);
          return;
        }
      }
      router.push(manageUrl);
    } catch {
      setSubmitError(
        "Contest could not be created. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="league-create-title"
      className="space-y-6"
    >
      <Link href={ROUTES.league} className={controlClass("outline", "sm")}>
        <ArrowLeft size={14} aria-hidden="true" />
        League
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>League</p>
          <h1
            id="league-create-title"
            className={`mt-1 ${PAGE_TITLE} text-on-surface`}
          >
            Create a contest
          </h1>
          {organizerName ? (
            <p className={`mt-2 max-w-xl ${BODY}`}>
              You&apos;ll be the main organizer, {organizerName}, and you can
              judge runs too. Invite riders with a QR code once the contest exists.
            </p>
          ) : null}
        </div>
        <span className={tagClass("neutral")}>Free plan · up to 3 riders</span>
      </header>

      <FormSection
        icon={Trophy}
        title="Contest essentials"
        intro="Name your contest and describe it for riders who join from the QR code or invite link."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="league-name"
            label="Contest name"
            value={name}
            onChange={setName}
            placeholder="e.g. Riverside Night Jam"
            required
            error={errors.name}
            autoComplete="off"
          />
          <TextField
            id="league-short-name"
            label="Short name"
            value={shortName}
            onChange={setShortName}
            placeholder="e.g. RNJ26"
            error={errors.shortName}
            hint="Optional — shown under the title."
            autoComplete="off"
          />
          <TextareaField
            id="league-description"
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="What should riders and judges expect?"
            error={errors.description}
            className="sm:col-span-2"
          />
          <SelectField
            id="league-category"
            label="Category"
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
            required
            error={errors.category}
          />
          <div className="sm:col-span-2">
            <FieldLabel required>Disciplines</FieldLabel>
            <ul
              className="flex flex-wrap gap-2"
              aria-label="Contest disciplines"
            >
              {DISCIPLINE_OPTIONS.map((value) => {
                const active = sports.includes(value);
                return (
                  <li key={value}>
                    <label
                      className={`${chipClass(active)} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleSport(value)}
                        className="sr-only"
                        aria-invalid={errors.sports ? true : undefined}
                        aria-describedby={
                          errors.sports ? "league-sports-error" : undefined
                        }
                      />
                      {value}
                    </label>
                  </li>
                );
              })}
            </ul>
            <FieldMessages id="league-sports" error={errors.sports} />
          </div>
          <ContestCoverField
            id="league-cover"
            file={coverFile}
            onFileChange={setCoverFile}
            categoryName={
              CATEGORY_OPTIONS.find((option) => option.value === category)
                ?.label ?? ""
            }
            sports={sports}
            disabled={busy}
          />
        </div>
      </FormSection>

      <FormSection
        icon={CalendarClock}
        title="Schedule"
        intro="Contests can start at most two months ahead. Judging windows are set per run once the schedule is generated."
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
            appearance="pill"
          />
          <DateField
            id="league-end-date"
            label="End date"
            value={endDate}
            onChange={setEndDate}
            error={errors.endDate}
            min={startDate || undefined}
            hint="Leave blank for a one-day event."
            appearance="pill"
          />
          <TextField
            id="league-timezone"
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            placeholder="e.g. Europe/Madrid"
            required
            error={errors.timezone}
            hint="Detected from your device — used for the live schedule board."
            autoComplete="off"
            className="sm:col-span-2"
          />
        </div>
      </FormSection>

      <FormSection
        icon={MapPin}
        title="Location"
        intro="Where riders meet. The city and country are what the directory shows."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
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
            <FieldLabel htmlFor="league-country" required>
              Country
            </FieldLabel>
            <CountryAutocomplete
              id="league-country"
              value={country}
              onChange={setCountry}
              invalid={Boolean(errors.country)}
              appearance="pill"
            />
            <FieldMessages id="league-country" error={errors.country} />
          </div>
          <TextField
            id="league-venue"
            label="Venue"
            value={venue}
            onChange={setVenue}
            placeholder="e.g. Riverside skatepark"
            error={errors.venue}
            hint="Optional."
            className="sm:col-span-2"
          />
        </div>
      </FormSection>

      <FormSection
        icon={Link2}
        title="Links"
        intro="Optional — where riders follow the contest. Shown on the contest page."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="league-url"
            type="url"
            label="Official site"
            value={officialUrl}
            onChange={setOfficialUrl}
            placeholder="https://"
            error={errors.url}
            autoComplete="url"
            className="sm:col-span-2"
          />
          <TextField
            id="league-instagram"
            type="url"
            label="Instagram"
            value={instagram}
            onChange={setInstagram}
            placeholder="https://instagram.com/…"
            error={errors.instagram}
            autoComplete="off"
          />
          <TextField
            id="league-youtube"
            type="url"
            label="YouTube"
            value={youtube}
            onChange={setYoutube}
            placeholder="https://youtube.com/…"
            error={errors.youtube}
            autoComplete="off"
          />
        </div>
      </FormSection>

      {submitError ? (
        <div role="alert" className={`text-sm ${alertClass("error")}`}>
          {submitError}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={ROUTES.league} className={controlClass("outline")}>
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
          className={controlClass("primary")}
        >
          {busy ? "Creating…" : "Create contest"}
        </button>
      </div>
    </form>
  );
}
