"use client";

import { useId } from "react";
import type { SportDiscipline } from "@/types/sport-events";
import {
  ImageSourceField,
  type ImageSourceFieldValue,
} from "./ImageSourceField";
import { LatLonEditor, type LatLonEditorMode } from "./LatLonEditor";
import { CountryAutocomplete } from "./CountryAutocomplete";
import type { ProjectedAddress } from "@/lib/geocode/project";
import type { SpotTypeEntity } from "@/lib/types";
import type { SportOption } from "@/lib/admin/taxonomy";

export interface SpotFormState {
  name: string;
  city: string;
  citySlug: string;
  address: string;
  country: string;
  countryCode: string;
  types: string[];
  sports: SportDiscipline[];
  image: ImageSourceFieldValue;
  lat: number;
  lon: number;
  instagram: string;
}
interface SpotFormFieldsProps {
  state: SpotFormState;
  onChange: (next: SpotFormState) => void;
  errors?: Partial<Record<keyof SpotFormState | "location", string>>;
  latLonMode?: LatLonEditorMode;
  onAutoFillResult?: (address: ProjectedAddress) => void;
  onError?: (message: string) => void;
  spotTypes: readonly SpotTypeEntity[];
  sportOptions: readonly SportOption[];
}

export function SpotFormFields({
  state,
  onChange,
  errors,
  latLonMode = "preview",
  onAutoFillResult,
  onError,
  spotTypes,
  sportOptions,
}: SpotFormFieldsProps) {
  const nameId = useId();
  const cityId = useId();
  const addressId = useId();
  const countryId = useId();
  const instagramId = useId();
  const typesLegendId = useId();
  const sportsLegendId = useId();
  const typesErrorId = useId();
  const sportsErrorId = useId();
  const countryErrorId = useId();
  const instagramErrorId = useId();
  const locationErrorId = useId();
  const summaryErrorId = useId();
  const nameErrorId = `${nameId}-error`;
  const cityErrorId = `${cityId}-error`;

  const update = <K extends keyof SpotFormState>(
    key: K,
    value: SpotFormState[K],
  ) => onChange({ ...state, [key]: value });

  const handleCountryChange = (next: { name: string; code: string }) => {
    onChange({ ...state, country: next.name, countryCode: next.code });
  };

  const toggleSport = (sport: SportDiscipline) => {
    if (state.sports.includes(sport)) {
      update(
        "sports",
        state.sports.filter((s) => s !== sport),
      );
    } else {
      update("sports", [...state.sports, sport]);
    }
  };

  const toggleType = (slug: string) => {
    if (state.types.includes(slug)) {
      update(
        "types",
        state.types.filter((s) => s !== slug),
      );
    } else {
      update("types", [...state.types, slug]);
    }
  };

  return (
    <div className="space-y-8">
      <LatLonEditor
        lat={state.lat}
        lon={state.lon}
        mode={latLonMode}
        onChange={(lat, lon) => onChange({ ...state, lat, lon })}
        onAutoFillResult={onAutoFillResult}
        onError={onError}
        invalid={Boolean(errors?.location)}
        required
      />
      {errors?.location ? (
        <p id={locationErrorId} role="alert" className="rounded-lg border border-error/30 bg-error-container/30 px-4 py-2 text-xs text-error">
          {errors.location}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor={nameId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Spot name <span aria-hidden="true">*</span>
          </label>
          <input
            id={nameId}
            type="text"
            required
            autoComplete="off"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. The White Marble Nine"
            aria-invalid={Boolean(errors?.name)}
            aria-describedby={errors?.name ? nameErrorId : undefined}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none sm:text-sm aria-[invalid=true]:border-error"
          />
          {errors?.name ? (
            <p id={nameErrorId} role="alert" className="mt-1 text-[10px] text-error">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor={cityId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            City <span aria-hidden="true">*</span>
          </label>
          <input
            id={cityId}
            type="text"
            required
            autoComplete="address-level2"
            value={state.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="e.g. Los Angeles, CA"
            aria-invalid={Boolean(errors?.city)}
            aria-describedby={errors?.city ? cityErrorId : undefined}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none sm:text-sm aria-[invalid=true]:border-error"
          />
          {errors?.city ? (
            <p id={cityErrorId} role="alert" className="mt-1 text-[10px] text-error">
              {errors.city}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor={countryId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Country <span aria-hidden="true">*</span>
          </label>
          <CountryAutocomplete
            id={countryId}
            value={{ name: state.country, code: state.countryCode }}
            onChange={handleCountryChange}
            onError={onError}
            invalid={Boolean(errors?.country)}
          />
          {errors?.country ? (
            <p id={countryErrorId} role="alert" className="mt-1 text-[10px] text-error">
              {errors.country}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor={addressId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Address
          </label>
          <input
            id={addressId}
            type="text"
            autoComplete="street-address"
            value={state.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="e.g. Hope Street, L.A."
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none sm:text-sm"
          />
        </div>
      </div>

      <fieldset
        aria-labelledby={typesLegendId}
        aria-describedby={errors?.types ? typesErrorId : undefined}
        aria-invalid={Boolean(errors?.types)}
        className="rounded-lg border border-outline-variant bg-surface-container-low p-5 aria-[invalid=true]:border-error"
      >
        <legend id={typesLegendId} className="flex items-center px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Spot types{" "}
          <span aria-hidden="true" className="ml-1 text-primary">
            *
          </span>
        </legend>
        <p className="mb-3 text-[10px] text-secondary">
          Pick every type this spot supports — plaza, bowl, rails, DIY, etc.
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Spot types">
          {spotTypes.map((opt) => {
            const active = state.types.includes(opt.slug);
            return (
              <li key={opt.slug}>
                <label
                  className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-1 text-[10px] font-semibold transition-all ${
                    active
                      ? "border-primary bg-primary text-surface"
                      : "border-outline-variant bg-surface text-on-surface hover:border-outline"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleType(opt.slug)}
                    className="sr-only"
                    aria-label={opt.name}
                  />
                  {opt.name}
                </label>
              </li>
            );
          })}
        </ul>
        {errors?.types ? (
          <p id={typesErrorId} role="alert" className="mt-3 text-[10px] text-error">
            {errors.types}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
        <legend className="flex items-center px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Social profiles
        </legend>
        <p className="mb-3 text-[10px] text-secondary">
          Full URL to the spot's public profile. Leave blank if there is no
          presence on that platform. Stored as a full URL so the UI can drop it
          into a link directly.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor={instagramId}
              className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
            >
              Instagram
            </label>
            <input
              id={instagramId}
              type="url"
              autoComplete="url"
              value={state.instagram}
              onChange={(e) => update("instagram", e.target.value)}
              placeholder="https://instagram.com/handle"
              aria-invalid={Boolean(errors?.instagram)}
              aria-describedby={errors?.instagram ? instagramErrorId : undefined}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none sm:text-sm aria-[invalid=true]:border-error"
            />
            {errors?.instagram ? (
              <p id={instagramErrorId} role="alert" className="mt-1 text-[10px] text-error">
                {errors.instagram}
              </p>
            ) : null}
          </div>
        </div>
      </fieldset>

      <ImageSourceField
        value={state.image}
        onChange={(v) => update("image", v)}
      />

      <fieldset
        aria-labelledby={sportsLegendId}
        aria-describedby={errors?.sports ? sportsErrorId : undefined}
        aria-invalid={Boolean(errors?.sports)}
        className="rounded-lg border border-outline-variant bg-surface-container-low p-5 aria-[invalid=true]:border-error"
      >
        <legend id={sportsLegendId} className="flex items-center px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Sport types <span aria-hidden="true" className="ml-1 text-primary">*</span>
        </legend>
        <p className="mb-3 text-[10px] text-secondary">
          Which disciplines does this spot support? Pick all that apply.
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Sport types">
          {sportOptions.map((sportOption) => {
            const sport = sportOption.value
            const active = state.sports.includes(sport);
            return (
              <li key={sport}>
                <label
                  className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-1 text-[10px] font-semibold transition-all ${
                    active
                      ? "border-primary bg-primary text-surface"
                      : "border-outline-variant bg-surface text-on-surface hover:border-outline"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleSport(sport)}
                    className="sr-only"
                    aria-label={sport}
                  />
                  {sportOption.label}
                </label>
              </li>
            );
          })}
        </ul>
        {errors?.sports ? (
          <p id={sportsErrorId} role="alert" className="mt-3 text-[10px] text-error">
            {errors.sports}
          </p>
        ) : null}
      </fieldset>

      {Object.values(errors ?? {}).some(Boolean) &&
      // avoid duplicate summary when only location/types/sports already shown as field errors
      Object.entries(errors ?? {}).filter(([k]) => !["location", "types", "sports", "country", "city", "name", "instagram"].includes(k)).length > 0 ? (
        <p
          id={summaryErrorId}
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/30 px-4 py-2 text-xs text-error"
        >
          {Object.entries(errors ?? {})
            .filter(([k]) => !["location", "types", "sports"].includes(k))
            .map(([, v]) => v)
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
