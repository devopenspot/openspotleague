"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { WeatherIcon } from "@/components/spots/weather/WeatherIcon";
import { LocationBlockedCallout } from "@/components/ui/LocationBlockedCallout";
import { formatDistance } from "@/lib/spots/geo";
import { type useUserLocation } from "@/hooks/map/useUserLocation";
import { formatTemp } from "@/lib/weather/format";
import type { Spot, WeatherIconName } from "@/lib/types";
import type {
  GameCreationOptions,
  GameMode,
  RuleMode,
  TrickLevel,
} from "@/lib/schemas/game";
import type { SpotWeather } from "@/lib/weather/weather-cached";

export type FieldName =
  | "guestNickname"
  | "spotType"
  | "level"
  | "categories"
  | "spot"
  | "weather"
  | "weatherObserved";
export type FieldErrors = Partial<Record<FieldName, string>>;
export type GameCreationSpotType = GameCreationOptions["spotTypes"][number];
export type GameSetupStep = "settings" | "trick" | "time" | "spot" | "confirm";

export const WEATHER_LIVE_OPTIONS: ReadonlyArray<{
  value: WeatherIconName;
  label: string;
}> = [
  { value: "sunny", label: "Sunny" },
  { value: "cloudy", label: "Cloudy" },
  { value: "rain", label: "Rain" },
] as const;

export const GAME_CREATE_FORM_ID = "game-create-form";

export const GAME_SETTINGS_ANCHOR_ID = "anchor-settings-land";

export const CHALLENGE_START_OPTIONS = [
  { value: 0, title: "Start now", description: "Open the lobby immediately." },
  {
    value: 3,
    title: "In 3 minutes",
    description: "Give riders a short join window.",
  },
  {
    value: 5,
    title: "In 5 minutes",
    description: "Allow more time to join and verify.",
  },
] as const;
export type ChallengeStartDelay =
  (typeof CHALLENGE_START_OPTIONS)[number]["value"];

function getControlId(prefix: string, id: string) {
  return prefix ? `${prefix}-${id}` : id;
}

export function GuestNicknameField({
  id = "guest-nickname",
  value,
  error,
  onChange,
}: {
  id?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <label
        htmlFor={id}
        className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary"
      >
        Rider name
      </label>
      <input
        id={id}
        type="text"
        form={GAME_CREATE_FORM_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={30}
        placeholder="Your name in the lobby"
        autoComplete="nickname"
        inputMode="text"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-3 min-h-11 w-full rounded-[16px] border border-outline-variant bg-surface-container-lowest px-3 font-sans text-base outline-none placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function OptionChip({
  active,
  label,
  role,
  ariaChecked,
  disabled = false,
  invalid = false,
  onClick,
  id,
  tabIndex,
  onKeyDown,
}: {
  active: boolean;
  label: string;
  role: "radio";
  ariaChecked: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onClick: () => void;
  id?: string;
  tabIndex?: number;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role={role}
      aria-checked={ariaChecked}
      data-invalid={invalid ? "true" : undefined}
      disabled={disabled}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${active ? "bg-on-surface text-surface" : "border border-outline bg-surface"}`}
    >
      {label}
    </button>
  );
}

export function GameFormatSettings({
  idPrefix = "",
  optionsLoading,
  activeOptionsError,
  availableSpotTypes,
  effectiveSpotType,
  selectedSpotType,
  effectiveLevel,
  availableLevels,
  levelCounts,
  ruleMode,
  fieldErrors,
  onSpotTypeChange,
  onLevelChange,
  onRuleModeChange,
  clearFieldError: _clearFieldError,
}: {
  idPrefix?: string;
  optionsLoading: boolean;
  activeOptionsError: string | null;
  availableSpotTypes: readonly GameCreationSpotType[];
  effectiveSpotType: string;
  selectedSpotType?: GameCreationSpotType;
  effectiveLevel: TrickLevel;
  availableLevels: readonly TrickLevel[];
  levelCounts?: Map<number, number>;
  ruleMode: RuleMode;
  fieldErrors: FieldErrors;
  onSpotTypeChange: (spotType: string) => void;
  onLevelChange: (level: TrickLevel) => void;
  onRuleModeChange: (ruleMode: RuleMode) => void;
  clearFieldError: (field: FieldName) => void;
}) {
  void _clearFieldError;
  const controlId = (id: string) => getControlId(idPrefix, id);

  return (
    <fieldset className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <legend className="px-1 font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
        Trick settings
      </legend>
      <div className="mt-4 space-y-6">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p
              id={controlId(GAME_SETTINGS_ANCHOR_ID)}
              tabIndex={-1}
              className="scroll-mt-20 font-display text-xs font-bold uppercase tracking-[0.05em] outline-none"
            >
              Spot type
            </p>
            <span className="inline-flex rounded-[8px] border border-outline-variant bg-surface-container px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
              Default selected
            </span>
          </div>
          {optionsLoading ? (
            <div
              className="mt-3 h-11 animate-pulse rounded-[16px] border border-outline-variant bg-surface-container"
              aria-label="Loading spot types"
            />
          ) : activeOptionsError ? (
            <p
              className="mt-3 rounded-[8px] bg-error-container px-3 py-3 text-sm text-on-error-container"
              role="alert"
            >
              {activeOptionsError}
            </p>
          ) : availableSpotTypes.length === 0 ? (
            <p className="mt-3 rounded-[8px] bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
              No compatible spot types are available for this game.
            </p>
          ) : (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Spot type"
            >
              {availableSpotTypes.map((option, index) => (
                <OptionChip
                  key={option.slug}
                  active={effectiveSpotType === option.slug}
                  label={option.name}
                  role="radio"
                  ariaChecked={effectiveSpotType === option.slug}
                  invalid={Boolean(fieldErrors.spotType) && index === 0}
                  onClick={() => onSpotTypeChange(option.slug)}
                />
              ))}
            </div>
          )}
          {fieldErrors.spotType ? (
            <FieldError>{fieldErrors.spotType}</FieldError>
          ) : null}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-xs font-bold uppercase tracking-[0.05em]">
              Level
            </p>
            <span className="inline-flex rounded-[8px] border border-outline-variant bg-surface-container px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
              Level {selectedSpotType?.levels[0] ?? 1} default
            </span>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Trick level"
          >
            {([1, 2, 3, 4, 5] as const).map((option, index) => {
              const hasData = levelCounts
                ? Array.from(levelCounts.values()).some((v) => v > 0)
                : false;
              return (
                <OptionChip
                  key={option}
                  active={effectiveLevel === option}
                  label={
                    hasData
                      ? `Level ${option} (${levelCounts?.get(option) ?? 0})`
                      : `Level ${option}`
                  }
                  role="radio"
                  ariaChecked={effectiveLevel === option}
                  disabled={
                    !selectedSpotType || !availableLevels.includes(option)
                  }
                  invalid={Boolean(fieldErrors.level) && index === 0}
                  onClick={() => onLevelChange(option)}
                />
              );
            })}
          </div>
          {fieldErrors.level ? (
            <FieldError>{fieldErrors.level}</FieldError>
          ) : null}
        </div>

        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.05em]">
            Rule mode
          </p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Flexible: leader can move on. Strict: challenge stays open.
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Rule mode"
          >
            <OptionChip
              active={ruleMode === "flexible"}
              label="Flexible"
              role="radio"
              ariaChecked={ruleMode === "flexible"}
              onClick={() => onRuleModeChange("flexible")}
            />
            <OptionChip
              active={ruleMode === "strict"}
              label="Strict"
              role="radio"
              ariaChecked={ruleMode === "strict"}
              onClick={() => onRuleModeChange("strict")}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export function CategoriesField({
  categories,
  selectedCategories,
  error,
  onToggle,
  disabled,
  eligibleCount,
  effectiveSpotType,
  effectiveLevel,
  categoryCounts,
}: {
  categories: readonly string[];
  selectedCategories: readonly string[];
  error?: string;
  onToggle: (category: string) => void;
  disabled?: boolean;
  eligibleCount?: number | null;
  effectiveSpotType?: string;
  effectiveLevel?: number;
  categoryCounts?: Map<string, number>;
}) {
  const isAll = selectedCategories.length === 0;
  return (
    <fieldset className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <legend className="px-1 font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
        Categories
      </legend>
      {categories.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-on-surface-variant">
          No categories configured for this discipline — tricks will be drawn
          from the full pool. Continue.
        </p>
      ) : (
        <>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Categories"
          >
            <button
              type="button"
              aria-pressed={isAll}
              disabled={disabled}
              onClick={() => {
                if (!isAll) {
                  // clear to All
                  categories.forEach((c) => {
                    if (
                      selectedCategories.some(
                        (sc) => sc.toLowerCase() === c.toLowerCase(),
                      )
                    )
                      onToggle(c);
                  });
                }
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${isAll ? "bg-on-surface text-surface" : "border border-outline bg-surface"}`}
            >
              All
            </button>
            {categories.map((cat) => {
              const active = selectedCategories.some(
                (c) => c.toLowerCase() === cat.toLowerCase(),
              );
              const count =
                categoryCounts?.get(cat.toLowerCase()) ??
                categoryCounts?.get(cat) ??
                0;
              const hasData = categoryCounts
                ? Array.from(categoryCounts.values()).some((v) => v > 0)
                : false;
              const zero = hasData && count === 0 && !active;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  data-invalid={error ? "true" : undefined}
                  disabled={disabled || zero}
                  title={
                    zero
                      ? `No tricks for ${cat} at Level ${effectiveLevel} ${effectiveSpotType}`
                      : hasData
                        ? `${count} trick${count === 1 ? "" : "s"}`
                        : undefined
                  }
                  onClick={() => onToggle(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${active ? "bg-on-surface text-surface" : zero ? "border border-outline bg-surface-container-high text-on-surface-variant opacity-50" : "border border-outline bg-surface"}`}
                >
                  {cat} {hasData ? `(${count})` : ""}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || isAll}
              onClick={() =>
                [...selectedCategories].forEach((c) => onToggle(c))
              }
              className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.05em] disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          {error ? (
            <FieldError>{error}</FieldError>
          ) : eligibleCount === 0 ? (
            <p role="alert" className="mt-2 text-xs leading-5 text-error">
              No tricks match Level {effectiveLevel} at {effectiveSpotType} with{" "}
              {selectedCategories.join(", ")} — try All, another level, or
              another spot type.
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-on-surface-variant">
            {isAll
              ? "All categories (unfiltered)"
              : `${selectedCategories.length} selected · max 12`}
            {eligibleCount !== null && eligibleCount !== undefined
              ? ` · ${eligibleCount} match${eligibleCount === 1 ? "" : "es"} for current spot+level`
              : ""}
          </p>
        </>
      )}
    </fieldset>
  );
}

export function SetupProgress({
  currentStep,
  steps,
}: {
  currentStep: GameSetupStep;
  steps: ReadonlyArray<{ id: GameSetupStep; label: string }>;
}) {
  const cols =
    steps.length === 5
      ? "grid-cols-5"
      : steps.length === 4
        ? "grid-cols-4"
        : "grid-cols-3";
  return (
    <nav
      aria-label="Game setup progress"
      className="border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6"
    >
      <ol className={`grid gap-2 ${cols}`}>
        {steps.map((step, index) => {
          const active = step.id === currentStep;
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={`min-w-0 border-t-2 pt-2 ${active ? "border-primary" : "border-outline-variant"}`}
            >
              <span
                className={`block font-display text-xs font-bold uppercase tracking-[0.08em] ${active ? "text-on-surface" : "text-on-surface-variant"}`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`mt-1 hidden truncate font-display text-xs font-bold uppercase tracking-[0.04em] sm:block ${active ? "text-on-surface" : "text-on-surface-variant"}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ChallengeTimeStep({
  idPrefix = "",
  startDelayMinutes,
  onStartDelayChange,
  timezone,
}: {
  idPrefix?: string;
  startDelayMinutes: ChallengeStartDelay;
  onStartDelayChange: (value: ChallengeStartDelay) => void;
  timezone: string;
}) {
  const controlId = (id: string) => getControlId(idPrefix, id);
  const startLabelId = controlId("challenge-start-label");

  return (
    <div className="space-y-5">
      <div className="rounded-[16px] border border-outline-variant bg-surface-container-low p-4">
        <p className="font-display text-sm font-bold uppercase">
          Confirm when the lobby opens
        </p>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Riders can join during the countdown. The host can start early once
          every active rider is ready.
        </p>
      </div>
      <fieldset className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <legend
          id={startLabelId}
          className="px-1 font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
        >
          Challenge start
        </legend>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby={startLabelId}
        >
          {CHALLENGE_START_OPTIONS.map((option) => (
            <OptionChip
              key={option.value}
              active={startDelayMinutes === option.value}
              label={option.title}
              role="radio"
              ariaChecked={startDelayMinutes === option.value}
              onClick={() => onStartDelayChange(option.value)}
            />
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-on-surface-variant">
          {CHALLENGE_START_OPTIONS.find((o) => o.value === startDelayMinutes)
            ?.description ?? ""}
        </p>
        <p className="mt-3 text-xs leading-5 text-on-surface-variant">
          Your browser timezone is applied automatically
          {timezone ? ` (${timezone})` : ""}. The selected start is shared with
          every rider in the lobby.
        </p>
      </fieldset>
      <p className="border-t border-outline-variant pt-4 text-sm leading-6 text-on-surface-variant">
        Every joined rider must be signed in and verified at the registered spot
        before the challenge can start. The start window includes a 15-minute
        grace period.
      </p>
    </div>
  );
}

export function ChallengeSpotStep({
  selectedSpot,
  selectedDistanceMeters,
  distanceUnit,
  locationStatus,
  locationLoading,
  spotAccepted,
  fieldError,
  onSpotAcceptance,
  onContinueTraining,
  onRetryLocation,
}: {
  selectedSpot: Spot | null;
  selectedDistanceMeters: number | null;
  distanceUnit: "km" | "mi";
  locationStatus: ReturnType<typeof useUserLocation>["status"];
  locationLoading: boolean;
  spotAccepted: boolean | null;
  fieldError?: string;
  onSpotAcceptance: (accepted: boolean) => void;
  onContinueTraining: () => void;
  onRetryLocation: () => void;
}) {
  return (
    <Field label="Nearby registered spot" error={fieldError}>
      <div
        className="space-y-3"
        data-invalid={fieldError ? "true" : undefined}
        tabIndex={fieldError ? -1 : undefined}
      >
        <p
          className="text-xs leading-5 text-on-surface-variant"
          role="status"
          aria-live="polite"
        >
          {locationStatus === "requesting"
            ? "Checking your location..."
            : locationLoading
              ? "Finding the nearest compatible spot within 250 meters..."
              : selectedSpot
                ? `${selectedSpot.name} is the only compatible spot found within 250 meters.`
                : locationStatus === "granted"
                  ? "No compatible registered spot was found within 250 meters."
                  : locationStatus === "denied"
                    ? "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again. Or continue with Training."
                    : locationStatus === "unavailable"
                      ? "Challenge needs your location to find a registered spot. Tap Try again or continue with Training."
                      : "Location is required to show a registered spot. Tap Try again to allow it."}
        </p>
        {selectedSpot ? (
          <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold uppercase">
                  {selectedSpot.name}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {selectedSpot.city}
                </p>
              </div>
              {selectedDistanceMeters === null ? null : (
                <span className="shrink-0 font-display text-xs uppercase tracking-[0.05em] text-secondary">
                  {formatDistance(selectedDistanceMeters, distanceUnit)}
                </span>
              )}
            </div>
            <fieldset className="mt-4 border-t border-outline-variant pt-3">
              <legend className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                Is this the spot you want to use?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={spotAccepted === true}
                  onClick={() => onSpotAcceptance(true)}
                  className={`min-h-11 rounded-full px-4 font-display text-xs font-bold uppercase tracking-[0.05em] transition-[background-color,border-color,color,transform] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 ${spotAccepted === true ? "border border-on-surface bg-on-surface text-surface" : "border border-outline-variant bg-surface-container-high text-on-surface hover:border-outline hover:bg-surface-container-highest"}`}
                >
                  Yes, use this spot
                </button>
                <button
                  type="button"
                  aria-pressed={spotAccepted === false}
                  onClick={() => onSpotAcceptance(false)}
                  className={`min-h-11 rounded-full px-4 font-display text-xs font-bold uppercase tracking-[0.05em] transition-[background-color,border-color,color,transform] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 ${spotAccepted === false ? "border border-error bg-error-container text-on-error-container" : "border border-outline-variant bg-surface-container-high text-on-surface hover:border-outline hover:bg-surface-container-highest"}`}
                >
                  No, not this spot
                </button>
              </div>
              {spotAccepted === false ? (
                <p className="mt-3 text-sm leading-5 text-error" role="status">
                  Challenge creation stays locked until you accept the nearby
                  spot.
                </p>
              ) : null}
            </fieldset>
          </div>
        ) : (
          <div className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low px-3 py-4 text-sm leading-5 text-on-surface-variant">
            The challenge can only be created when a compatible spot is found
            near your current location.
          </div>
        )}
        {locationStatus === "denied" ? (
          <LocationBlockedCallout onRetry={onRetryLocation} />
        ) : null}
        {locationStatus === "denied" || locationStatus === "unavailable" ? (
          <button
            type="button"
            onClick={onContinueTraining}
            className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
          >
            Continue with Training
          </button>
        ) : null}
        {locationStatus !== "denied" ? (
          <button
            type="button"
            onClick={onRetryLocation}
            disabled={locationStatus === "requesting" || locationLoading}
            aria-label="Retry location"
            className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
          >
            {locationStatus === "requesting" || locationLoading
              ? "Checking location..."
              : "Retry location"}
          </button>
        ) : null}
      </div>
    </Field>
  );
}

export function WeatherConfirmSection({
  idPrefix = "",
  forecastWeather,
  weatherConfirmed,
  weatherObservedIcon,
  fieldError,
  observedFieldError,
  onConfirm,
  onObservedChange,
  temperatureUnit,
}: {
  idPrefix?: string;
  forecastWeather?: SpotWeather | null;
  weatherConfirmed: boolean | null;
  weatherObservedIcon: WeatherIconName | null;
  fieldError?: string;
  observedFieldError?: string;
  onConfirm: (confirmed: boolean) => void;
  onObservedChange: (icon: WeatherIconName) => void;
  temperatureUnit: "C" | "F";
}) {
  const controlId = (id: string) => (idPrefix ? `${idPrefix}-${id}` : id);
  const confirmedGroupId = controlId("weather-confirm-group");
  const observedGroupId = controlId("weather-observed-group");

  return (
    <Field label="Current weather" error={fieldError}>
      <div className="space-y-3" data-invalid={fieldError ? "true" : undefined}>
        <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
              Forecast at spot
            </p>
            {forecastWeather ? (
              <WeatherIcon
                name={forecastWeather.icon}
                size={28}
                className="shrink-0"
              />
            ) : (
              <span className="text-xs text-on-surface-variant">Loading…</span>
            )}
          </div>
          {forecastWeather ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-display text-2xl font-bold leading-none">
                {formatTemp(forecastWeather.current, temperatureUnit)}
              </span>
              <span className="text-xs leading-5 text-on-surface-variant">
                {forecastWeather.description || forecastWeather.icon}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-5 text-on-surface-variant">
              Fetching forecast for this spot…
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-on-surface-variant">
            Use live observation to confirm. This will be saved with the game
            and shown on the spot.
          </p>
        </div>

        <fieldset className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
          <legend className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
            Is the forecast correct right now?
          </legend>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="radiogroup"
            aria-labelledby={confirmedGroupId}
            id={confirmedGroupId}
          >
            <button
              type="button"
              role="radio"
              aria-checked={weatherConfirmed === true}
              data-invalid={fieldError ? "true" : undefined}
              onClick={() => onConfirm(true)}
              className={`min-h-11 rounded-full border px-4 font-display text-xs font-bold uppercase tracking-[0.05em] transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${weatherConfirmed === true ? "border-on-surface bg-on-surface text-surface" : "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline"}`}
            >
              Yes, correct
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={weatherConfirmed === false}
              data-invalid={fieldError ? "true" : undefined}
              onClick={() => onConfirm(false)}
              className={`min-h-11 rounded-full border px-4 font-display text-xs font-bold uppercase tracking-[0.05em] transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${weatherConfirmed === false ? "border-on-surface bg-on-surface text-surface" : "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline"}`}
            >
              No, different
            </button>
          </div>
          {fieldError ? <FieldError>{fieldError}</FieldError> : null}
        </fieldset>

        {weatherConfirmed === false ? (
          <fieldset className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
            <legend className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
              Select the live weather you see
            </legend>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-labelledby={observedGroupId}
              id={observedGroupId}
            >
              {WEATHER_LIVE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={weatherObservedIcon === option.value}
                  data-invalid={observedFieldError ? "true" : undefined}
                  onClick={() => onObservedChange(option.value)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-display text-xs font-bold uppercase tracking-[0.05em] transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${weatherObservedIcon === option.value ? "border-on-surface bg-on-surface text-surface" : "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline"}`}
                >
                  <WeatherIcon
                    name={option.value}
                    size={16}
                    aria-hidden="true"
                  />
                  {option.label}
                </button>
              ))}
            </div>
            {observedFieldError ? (
              <FieldError>{observedFieldError}</FieldError>
            ) : null}
          </fieldset>
        ) : null}
      </div>
    </Field>
  );
}

export function ConfigurationSummary({
  mode,
  ruleMode,
  spotType,
  level,
  categories,
  physicalSpot,
  scheduledStart,
  timezone,
  weather,
}: {
  mode: GameMode;
  ruleMode: RuleMode;
  spotType: string;
  level: TrickLevel;
  categories: string;
  physicalSpot: string;
  scheduledStart: string;
  timezone: string;
  weather: string;
}) {
  const items = [
    ["Mode", mode === "training" ? "Training" : "Challenge"],
    ["Rule", ruleMode === "flexible" ? "Flexible" : "Strict"],
    ["Spot type", spotType],
    ["Level", `Level ${level}`],
    ["Categories", categories],
    ...(mode === "challenge" || physicalSpot !== "Not selected"
      ? [["Physical spot", physicalSpot] as const]
      : []),
    ...(mode === "challenge"
      ? [
          ["Starts", scheduledStart],
          ["Timezone", timezone],
        ]
      : []),
    ["Weather", weather],
  ] as const;

  return (
    <aside className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 lg:top-24 mb-4">
      <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
        Your setup
      </p>
      <dl className="mt-4 divide-y divide-outline-variant border-t border-outline-variant">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 py-3"
          >
            <dt className="text-xs leading-5 text-on-surface-variant">
              {label}
            </dt>
            <dd className="max-w-[10rem] text-right font-display text-sm font-bold uppercase leading-5">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function CreateSubmitButton({
  formId,
  mode,
  disabled,
  busy,
  testId,
}: {
  formId: string;
  mode: GameMode;
  disabled: boolean;
  busy: boolean;
  testId?: string;
}) {
  return (
    <button
      type="submit"
      form={formId}
      disabled={disabled}
      data-testid={testId}
      className="min-h-12 w-60 rounded-full border border-primary bg-primary px-5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary shadow-[0_8px_24px_rgba(18,18,18,0.12)] transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none sm:w-auto"
    >
      {busy
        ? "Creating game..."
        : mode === "training"
          ? "Start Training"
          : "Create Challenge"}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  error,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  error?: string;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="block min-w-0">
      <label
        htmlFor={htmlFor}
        className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary"
      >
        {label}
      </label>
      <div className="mt-2.5 [&>input]:min-h-11 [&>input]:w-full [&>input]:rounded-[16px] [&>input]:border [&>input]:border-outline-variant [&>input]:bg-surface-container-lowest [&>input]:px-3 [&>input]:font-sans [&>input]:text-base sm:[&>input]:text-sm [&>input]:outline-none [&>input]:placeholder:text-on-surface-variant [&>input]:focus-visible:outline-2 [&>input]:focus-visible:outline-primary [&>input]:focus-visible:outline-offset-2">
        {children}
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <span
      id={id}
      role="alert"
      className="mt-2 block text-sm leading-5 text-error"
    >
      {children}
    </span>
  );
}
