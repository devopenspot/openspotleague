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
import { ArrowLeft, CalendarClock, Eye, Layers, Link2, MapPin, Trophy } from "lucide-react";
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
import { buildContestDetailUrl, buildContestManageUrl } from "@/lib/league/urls";
import { ROUTES } from "@/lib/navigation/nav";
import {
  FORMAT_TEMPLATES,
  RATED_FORMATS,
  RATING_DISCIPLINES,
  disciplineLabel,
  type RatedFormat,
  type RatingDiscipline,
} from "@/lib/league/rating/formats";

const CATEGORY_OPTIONS: { value: ContestCategory; label: string }[] =
  SportEventCategorySchema.options.map((value) => ({
    value,
    label: value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));

const DISCIPLINE_OPTIONS = [...SportDisciplineSchema.options];

type DivisionChoice = { discipline: RatingDiscipline; format: RatedFormat };

/** Sport titles ("Roller") for the chosen divisions, in catalog order. */
function sportsFor(divisions: readonly DivisionChoice[]): (typeof DISCIPLINE_OPTIONS)[number][] {
  return DISCIPLINE_OPTIONS.filter((sport) =>
    divisions.some((division) => division.discipline === sport.toLowerCase()),
  );
}

/** Video deadline: the end of the chosen day, UTC. */
function deadlineIso(date: string): string | undefined {
  return date ? `${date}T23:59:59.000Z` : undefined;
}

const noopSubscribe = () => () => {};

/** The browser's IANA zone, or UTC when it can't be read. */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface CuratorPlanOption {
  slug: string;
  name: string;
  maxRiders: number;
}

interface LeagueCreateFormProps {
  organizerName?: string;
  /**
   * Curator mode (`/admin/league/contests/new`): pick a comped plan, the
   * listing and featuring; posts to the curation API instead.
   */
  curator?: { plans: readonly CuratorPlanOption[] };
}

export function LeagueCreateForm({ organizerName, curator }: LeagueCreateFormProps) {
  const router = useRouter();
  const [planSlug, setPlanSlug] = useState(
    curator?.plans.find((plan) => plan.slug !== "free")?.slug ??
      curator?.plans[0]?.slug ??
      "free",
  );
  const [listPublicly, setListPublicly] = useState(false);
  const [featured, setFeatured] = useState(false);
  const canList = planSlug !== "free";
  const backHref = curator ? "/admin/league/contests" : ROUTES.league;
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [divisions, setDivisions] = useState<DivisionChoice[]>([]);
  const [submissionMode, setSubmissionMode] = useState<"live" | "video">("live");
  const [deadlineDate, setDeadlineDate] = useState("");
  const sports = sportsFor(divisions);
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

  function toggleDivision(choice: DivisionChoice) {
    setDivisions((current) =>
      current.some((division) => division.discipline === choice.discipline && division.format === choice.format)
        ? current.filter((division) => !(division.discipline === choice.discipline && division.format === choice.format))
        : [...current, choice],
    );
  }

  function payload() {
    return {
      name: name.trim(),
      shortName: shortName.trim() || undefined,
      description,
      sports,
      divisions: divisions.length > 0 ? divisions : undefined,
      submissionMode,
      submissionDeadlineAt: submissionMode === "video" ? deadlineIso(deadlineDate) : undefined,
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
    if (parsed.success && divisions.length > 0) {
      setErrors({});
      return true;
    }
    const fieldErrors: Record<string, string> = {};
    if (divisions.length === 0) fieldErrors.divisions = "Pick at least one division";
    if (parsed.success) {
      flushSync(() => setErrors(fieldErrors));
      return false;
    }
    for (const issue of parsed.error.issues) {
      const raw = issue.path[0];
      // Sports are derived from the divisions, so surface them there.
      const key = raw === "sports" ? "divisions" : raw;
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = key === "divisions" ? "Pick at least one division" : issue.message;
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
      const response = curator
        ? await fetch("/api/admin/league/contests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idempotencyKey: crypto.randomUUID(),
              contest: payload(),
              planSlug,
              visibility: canList && listPublicly ? "public" : "unlisted",
              featured: canList && listPublicly && featured,
            }),
          })
        : await fetch("/api/league/events", {
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
      const manageUrl = curator
        ? `/admin/league/contests/${data.id}`
        : buildContestManageUrl(data.slug);
      if (coverFile) {
        // The contest exists now; a failed cover upload must not block the
        // organizer — the console offers the upload again.
        const uploaded = await uploadContestCover({
          eventId: data.id,
          file: coverFile,
          expectedVersion: data.version,
        }).catch(() => null);
        if (!uploaded?.ok) {
          router.push(
            curator
              ? `${manageUrl}?cover=failed`
              : `${buildContestDetailUrl(data.slug)}?tab=run&cover=failed#hub`,
          );
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
      <Link href={backHref} className={controlClass("outline", "sm")}>
        <ArrowLeft size={14} aria-hidden="true" />
        {curator ? "Contests" : "League"}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>League</p>
          <h1
            id="league-create-title"
            className={`mt-1 ${PAGE_TITLE} text-on-surface`}
          >
            {curator ? "New curated contest" : "Create a contest"}
          </h1>
          {organizerName ? (
            <p className={`mt-2 max-w-xl ${BODY}`}>
              You&apos;ll be the main organizer, {organizerName}, and you can
              judge runs too. Invite riders with a QR code once the contest exists.
            </p>
          ) : null}
        </div>
        <span className={tagClass("neutral")}>
          {curator
            ? `Comped ${curator.plans.find((plan) => plan.slug === planSlug)?.name ?? planSlug} plan`
            : "Free plan · up to 3 riders"}
        </span>
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
        icon={Layers}
        title="Format"
        intro="Pick how riders compete and the divisions they can enter. Each division is a discipline and a format, with its own runs and standings."
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="sr-only">How riders compete</legend>
            <FieldLabel required>How riders compete</FieldLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "live", title: "Live", body: "Riders ride in person. You open each rider's judging window." },
                  { value: "video", title: "Video", body: "Riders paste a video link before a deadline. Judges score from a queue." },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-inner border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${submissionMode === option.value ? "border-primary bg-surface-container" : "border-outline-variant"}`}
                >
                  <input
                    type="radio"
                    name="league-submission-mode"
                    value={option.value}
                    checked={submissionMode === option.value}
                    onChange={() => setSubmissionMode(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-on-surface">{option.title}</span>
                  <span className={BODY}>{option.body}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {submissionMode === "video" ? (
            <DateField
              id="league-video-deadline"
              label="Video deadline"
              value={deadlineDate}
              onChange={setDeadlineDate}
              required
              error={errors.submissionDeadlineAt}
              min={startDate || new Date().toISOString().slice(0, 10)}
              hint="Videos are due by the end of this day (UTC), after the start date."
              appearance="pill"
            />
          ) : null}

          <div>
            <FieldLabel required>Divisions</FieldLabel>
            <div className="space-y-3" role="group" aria-label="Contest divisions">
              {RATING_DISCIPLINES.map((discipline) => (
                <div key={discipline} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 shrink-0 text-sm font-semibold text-on-surface">{disciplineLabel(discipline)}</span>
                  {RATED_FORMATS.map((format) => {
                    const active = divisions.some((division) => division.discipline === discipline && division.format === format);
                    return (
                      <label
                        key={format}
                        className={`${chipClass(active)} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleDivision({ discipline, format })}
                          className="sr-only"
                          aria-label={`${disciplineLabel(discipline)} ${FORMAT_TEMPLATES[format].label}`}
                          aria-invalid={errors.divisions ? true : undefined}
                          aria-describedby={errors.divisions ? "league-divisions-error" : undefined}
                        />
                        {FORMAT_TEMPLATES[format].label}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className={`mt-2 ${BODY}`}>
              Park and Street runs last 50 seconds and Vert 45. Street adds a best trick. Every division is judged on
              difficulty, style, amplitude, consistency and creativity.
            </p>
            <FieldMessages id="league-divisions" error={errors.divisions} />
          </div>
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
            hint="Leave blank for a one-day contest."
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

      {curator ? (
        <FormSection
          icon={Eye}
          title="Plan & listing"
          intro="Curated contests are comped. Public listing (directory, map, search) needs a paid plan."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              id="league-plan"
              label="Plan"
              value={planSlug}
              onChange={setPlanSlug}
              options={curator.plans.map((plan) => ({
                value: plan.slug,
                label: `${plan.name} · up to ${plan.maxRiders} riders`,
              }))}
              required
            />
            <div className="flex flex-col justify-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={canList && listPublicly}
                  disabled={!canList}
                  onChange={(event) => setListPublicly(event.target.checked)}
                />
                List publicly
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={canList && listPublicly && featured}
                  disabled={!canList || !listPublicly}
                  onChange={(event) => setFeatured(event.target.checked)}
                />
                Feature on the League page
              </label>
            </div>
          </div>
        </FormSection>
      ) : null}

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
        <Link href={backHref} className={controlClass("outline")}>
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
