"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { WeatherIcon } from "@/components/spots/weather/WeatherIcon";
import { LocationBlockedCallout } from "@/components/ui/LocationBlockedCallout";
import { formatDistance, formatRadius } from "@/lib/spots/geo";
import { DEFAULT_LOCATION_RADIUS_METERS } from "@/lib/games/definitions";
import {
  CARD,
  CARD_NESTED,
  INPUT,
  LABEL,
  chipClass,
  controlClass,
} from "@/components/ui/recipes";
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
  | "discipline"
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

const EMPTY_STATE_INLINE =
  "rounded-inner border border-dashed border-outline-variant bg-surface-container-low px-4 py-4 text-sm leading-5 text-on-surface-variant";

export const SPORT_REQUIRED_MESSAGE = "Pick a sport to load spots and levels.";

export function getEmptySpotTypesMessage(hasDiscipline: boolean) {
  return hasDiscipline
    ? "No compatible spot types are available for this game."
    : "Pick a sport above to load spots and levels.";
}

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
      className={`min-h-12 rounded-full border-2 px-4 text-sm font-bold uppercase transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:border-outline disabled:bg-surface-container-high disabled:text-on-surface-variant ${
        active
          ? "border-on-surface bg-on-surface text-surface"
          : "border-on-surface bg-surface text-on-surface hover:bg-surface-container"
      }`}
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
  hasDiscipline,
  onSpotTypeChange,
  onLevelChange,
  onRuleModeChange,
  clearFieldError: _clearFieldError,
}: {
  idPrefix?: string;
  hasDiscipline: boolean;
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

  const trickSettingsLabelId = controlId("trick-settings-label");
  return (
    <div
      role="group"
      aria-labelledby={trickSettingsLabelId}
      className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
    >
      <p
        id={trickSettingsLabelId}
        className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
      >
        Trick settings
      </p>
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
              className="mt-3 h-11  rounded-[16px] border border-outline-variant bg-surface-container"
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
              {getEmptySpotTypesMessage(hasDiscipline)}
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
    </div>
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
    <div
      role="group"
      aria-labelledby="categories-field-label"
      className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
    >
      <p
        id="categories-field-label"
        className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
      >
        Categories
      </p>
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
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                isAll
                  ? "border border-on-surface bg-on-surface text-surface"
                  : "border border-outline-variant bg-surface text-on-surface hover:border-outline hover:bg-surface-container"
              }`}
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
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                    active
                      ? "border border-on-surface bg-on-surface text-surface"
                      : zero
                        ? "border border-outline-variant bg-surface-container-high text-on-surface-variant opacity-50 cursor-not-allowed"
                        : "border border-outline-variant bg-surface text-on-surface hover:border-outline hover:bg-surface-container"
                  }`}
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
              className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest disabled:opacity-40"
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
    </div>
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
      <div
        role="group"
        aria-labelledby={startLabelId}
        className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
      >
        <p
          id={startLabelId}
          className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
        >
          Challenge start
        </p>
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
      </div>
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
  context = "challenge",
  quickAdd,
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
  /** Battle requires a spot; training only offers one. Changes the copy. */
  context?: "challenge" | "training";
  /** Rendered when the location is known but no registered spot is nearby. */
  quickAdd?: ReactNode;
}) {
  const noSpotHere =
    !selectedSpot && !locationLoading && locationStatus === "granted";
  const locationFailed =
    locationStatus === "denied" || locationStatus === "unavailable";
  const spotRejected = Boolean(selectedSpot) && spotAccepted === false;
  const battle = context === "challenge";
  const radius = formatRadius(DEFAULT_LOCATION_RADIUS_METERS, distanceUnit);
  const checking = locationStatus === "requesting" || locationLoading;
  const status =
    locationStatus === "requesting"
      ? "Checking your location..."
      : locationLoading
        ? `Looking for a spot within ${radius}...`
        : selectedSpot
          ? `${selectedSpot.name} is the closest spot for this game.`
          : locationStatus === "granted"
            ? `No registered spot for this game within ${radius}.`
            : locationStatus === "denied"
              ? "Location is blocked on this device."
              : locationStatus === "unavailable"
                ? battle
                  ? "A battle needs your location to find the spot. Try again, or play it as Training."
                  : "Your location isn't available right now. Try again, or log without a spot."
                : "Allow location to find the spot you're at.";
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
          {status}
        </p>
        {selectedSpot ? (
          <div className="rounded-container border border-outline-variant bg-surface-container-lowest p-4">
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
            <div
              role="group"
              aria-labelledby="confirm-spot-label"
              className="mt-4 border-t border-outline-variant pt-3"
            >
              <p
                id="confirm-spot-label"
                className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
              >
                Is this the spot you want to use?
              </p>
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
              {spotRejected ? (
                <p className="mt-3 text-sm leading-5 text-on-surface-variant" role="status">
                  {battle
                    ? "Add the place you're at as a new spot, or play it as Training."
                    : "Add the place you're at as a new spot, or pick Anywhere or Just a name."}
                </p>
              ) : null}
            </div>
            {selectedSpot.visibility === "personal" && battle ? (
              <p className="mt-3 text-xs leading-5 text-on-surface-variant" role="note">
                This spot is still personal. It becomes public once your
                opponent checks in here, and leaderboard points count from
                then on.
              </p>
            ) : null}
          </div>
        ) : noSpotHere && quickAdd ? null : (
          <div className={EMPTY_STATE_INLINE}>
            {battle
              ? "A battle needs a registered spot near you. Add the place you're at as a new spot, or play it as Training."
              : "No registered spot nearby. Pick Anywhere or Just a name to log this session. Signed-in riders can add this place to the map."}
          </div>
        )}
        {(noSpotHere || spotRejected) && quickAdd ? quickAdd : null}
        {locationStatus === "denied" ? (
          <LocationBlockedCallout onRetry={onRetryLocation} />
        ) : null}
        {battle && (locationFailed || noSpotHere || spotRejected) ? (
          <div className={CARD_NESTED}>
            <p className="text-sm leading-6 text-on-surface-variant">
              No spot? Play it as Training: any place works and your session
              is still saved. Battles at a registered spot earn leaderboard
              points.
            </p>
            <button
              type="button"
              onClick={onContinueTraining}
              className={`mt-3 ${controlClass("secondary")}`}
            >
              Play as Training
            </button>
          </div>
        ) : null}
        {!battle && locationFailed ? (
          <button
            type="button"
            onClick={onContinueTraining}
            className={controlClass("secondary")}
          >
            Log without a spot
          </button>
        ) : null}
        {locationStatus !== "denied" && spotAccepted !== true ? (
          <button
            type="button"
            onClick={onRetryLocation}
            disabled={checking}
            className={controlClass("outline")}
          >
            {checking ? "Checking location..." : "Retry location"}
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
  optional = false,
}: {
  idPrefix?: string;
  /** Training: weather is a journal note, never a blocker. */
  optional?: boolean;
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
    <Field label={optional ? "Current weather (optional)" : "Current weather"}>
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

        <div
          role="group"
          aria-labelledby={confirmedGroupId}
          className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4"
        >
          <p
            id={confirmedGroupId}
            className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
          >
            Is the forecast correct right now?
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="radiogroup"
            aria-labelledby={confirmedGroupId}
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
          {optional && weatherConfirmed !== null ? (
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Tap your answer again to skip the weather.
            </p>
          ) : null}
        </div>

        {weatherConfirmed === false ? (
          <div
            role="group"
            aria-labelledby={observedGroupId}
            className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4"
          >
            <p
              id={observedGroupId}
              className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
            >
              Select the live weather you see
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-labelledby={observedGroupId}
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
          </div>
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
    ["Mode", mode === "training" ? "Training" : "Battle"],
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
    <aside className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 lg:top-24 mb-4 text-on-surface">
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
            <dd className="max-w-[10rem] text-right font-display text-sm font-bold uppercase leading-5 text-on-surface">
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
          : "Create Battle"}
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

export type TrainingPlace = "none" | "spot" | "label";

const TRAINING_PLACE_OPTIONS: ReadonlyArray<{
  value: TrainingPlace;
  label: string;
  hint: string;
}> = [
  { value: "none", label: "Anywhere", hint: "Open play. No location needed." },
  {
    value: "spot",
    label: "At a spot",
    hint: "Find the spot you are at, or add it to the map.",
  },
  {
    value: "label",
    label: "Just a name",
    hint: "Type where you rode. No location check.",
  },
];

/**
 * Training is a journal, not a contest: where you rode is optional and
 * never blocks the session. Battles are where location is verified.
 */
export function TrainingPlaceStep({
  idPrefix = "",
  place,
  spotLabel,
  onPlaceChange,
  onSpotLabelChange,
  children,
}: {
  idPrefix?: string;
  place: TrainingPlace;
  spotLabel: string;
  onPlaceChange: (place: TrainingPlace) => void;
  onSpotLabelChange: (value: string) => void;
  /** The spot finder, rendered when `place === "spot"`. */
  children?: ReactNode;
}) {
  const labelId = `${idPrefix}training-place-label`;
  const inputId = `${idPrefix}training-spot-label`;
  const active = TRAINING_PLACE_OPTIONS.find((option) => option.value === place);
  return (
    <div className={`${CARD} space-y-4`}>
      <div>
        <p id={labelId} className={LABEL}>
          Where are you riding? (optional)
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby={labelId}
        >
          {TRAINING_PLACE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={place === option.value}
              onClick={() => onPlaceChange(option.value)}
              className={chipClass(place === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-on-surface-variant">
          {active?.hint} Every session is saved to your training history.
        </p>
      </div>
      {place === "label" ? (
        <div>
          <label htmlFor={inputId} className={LABEL}>
            Place name
          </label>
          <input
            id={inputId}
            className={`mt-2 ${INPUT}`}
            value={spotLabel}
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. My driveway"
            onChange={(event) => onSpotLabelChange(event.target.value)}
          />
        </div>
      ) : null}
      {place === "spot" ? children : null}
    </div>
  );
}
