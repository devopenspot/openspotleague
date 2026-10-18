"use client";

import { useId, useState } from "react";
import { Activity, Globe, Ruler, Thermometer, X } from "lucide-react";
import { Overlay } from "@/components/feedback/Overlay";
import { useUIStore } from "@/stores/ui-store";
import {
  usePreferencesStore,
  DEFAULT_DISTANCE_UNIT,
  DEFAULT_TEMPERATURE_UNIT,
  type DistanceUnit,
  type TemperatureUnit,
} from "@/stores/preferences-store";
import { SPORT_DISCIPLINES, type SportDiscipline } from "@/types/sport-events";
import { cn } from "@/lib/utils/cn";
import { useUser } from "@/lib/contexts/user-context";
import { SignInLink } from "@/components/shell/SignInLink";

const ONBOARDING_DIALOG_TITLE_ID = "onboarding-dialog-title";

type Mode = "onboarding" | "edit";

export function OnboardingDialog() {
  const titleId = useId() || ONBOARDING_DIALOG_TITLE_ID;
  const isOpen = useUIStore((s) => s.isOnboardingOpen);
  const mode = useUIStore((s) => s.preferenceDialogMode);
  const closeOnboarding = useUIStore((s) => s.closeOnboarding);
  const pendingAction = useUIStore((s) => s.pendingOnboardingAction);
  const pendingNext = useUIStore((s) => s.pendingOnboardingNext);

  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const hydrationStatus = usePreferencesStore((s) => s.hydrationStatus);
  const storedDistance = usePreferencesStore((s) => s.distanceUnit);
  const storedTemperature = usePreferencesStore((s) => s.temperatureUnit);
  const storedSport = usePreferencesStore((s) => s.preferredSport);
  const user = useUser();

  const isOnboarding = mode === "onboarding";

  const handleBack = () => {
    closeOnboarding();
  };

  const preferenceValuesReady =
    hydrationStatus === "ready" || hydrationStatus === "error";

  return (
    <Overlay
      isOpen={isOpen}
      onClose={isOnboarding ? () => undefined : closeOnboarding}
      labelledBy={titleId}
      role="dialog"
      closeOnBackdrop={!isOnboarding}
      containerClassName="bg-surface"
      panelClassName="max-w-md overflow-hidden !rounded-[16px] border border-outline-variant bg-surface-container-lowest"
    >
      {preferenceValuesReady ? (
        <OnboardingForm
          key={`${mode}-${isOpen ? "open" : "closed"}-${storedDistance}-${storedTemperature}-${storedSport ?? "none"}`}
          mode={mode}
          isOnboarding={isOnboarding}
          titleId={titleId}
          onSubmitOnboarding={() => {
            if (isOnboarding) {
              const action = pendingAction;
              closeOnboarding();
              action?.();
            } else {
              closeOnboarding();
            }
          }}
          onSubmitEdit={() => closeOnboarding()}
          onSave={async (d, t, sport) => {
            if (user) {
              const response = await fetch("/api/preferences", {
                method: "PATCH",
                cache: "no-store",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  distanceUnit: d,
                  temperatureUnit: t,
                  disciplineSlug: sport ? sport.toLowerCase() : null,
                }),
              });
              if (!response.ok) {
                throw new Error("Preferences could not be saved");
              }
              const saved = (await response.json()) as {
                distanceUnit: DistanceUnit;
                temperatureUnit: TemperatureUnit;
                disciplineSlug: string | null;
              };
              const savedSport =
                SPORT_DISCIPLINES.find(
                  (candidate) =>
                    candidate.toLowerCase() === saved.disciplineSlug,
                ) ?? null;
              setPreferences(
                {
                  distanceUnit: saved.distanceUnit,
                  temperatureUnit: saved.temperatureUnit,
                  preferredSport: savedSport,
                },
                { accountId: user.id, hasLocalChanges: false },
              );
              return;
            }
            setPreferences(
              { distanceUnit: d, temperatureUnit: t, preferredSport: sport },
              { accountId: null, hasLocalChanges: true },
            );
          }}
          onBack={isOnboarding ? undefined : handleBack}
        />
      ) : (
        <div className="p-6 text-sm text-on-surface-variant" role="status">
          Loading your preferences…
        </div>
      )}
      {!user && isOpen ? (
        <div className="border-t border-outline-variant bg-surface-container-low p-6">
          <p className="text-xs leading-5 text-on-surface-variant">
            Preferences are saved on this device. Sign in to use them across
            devices.
          </p>
          <SignInLink
            variant="drawer"
            className="!mt-3 !rounded-[9999px] !border-primary !bg-primary !px-6 !py-3 !text-on-primary transition-opacity hover:!bg-primary hover:!opacity-90"
            onClick={closeOnboarding}
            next={pendingNext ?? undefined}
          />
        </div>
      ) : null}
    </Overlay>
  );
}

interface OnboardingFormProps {
  mode: Mode;
  isOnboarding: boolean;
  titleId: string;
  onSubmitOnboarding: () => void;
  onSubmitEdit: () => void;
  onSave: (
    distance: DistanceUnit,
    temperature: TemperatureUnit,
    sport: SportDiscipline | null,
  ) => Promise<void>;
  onBack: (() => void) | undefined;
}

function OnboardingForm({
  mode,
  isOnboarding,
  titleId,
  onSubmitOnboarding,
  onSubmitEdit,
  onSave,
}: OnboardingFormProps) {
  const distanceUnit = usePreferencesStore((s) => s.distanceUnit);
  const temperatureUnit = usePreferencesStore((s) => s.temperatureUnit);
  const preferredSport = usePreferencesStore((s) => s.preferredSport);

  const initial = { distanceUnit, temperatureUnit, preferredSport };

  const [draftDistance, setDraftDistance] = useState<DistanceUnit>(
    initial.distanceUnit,
  );
  const [draftTemp, setDraftTemp] = useState<TemperatureUnit>(
    initial.temperatureUnit,
  );
  const [draftSport, setDraftSport] = useState<SportDiscipline | null>(
    initial.preferredSport,
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isOnboarding && !draftSport) {
      setSaveError("Choose a sport to continue.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draftDistance, draftTemp, draftSport);
      if (isOnboarding) onSubmitOnboarding();
      else onSubmitEdit();
    } catch {
      setSaveError("Your preferences could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraftDistance(DEFAULT_DISTANCE_UNIT);
    setDraftTemp(DEFAULT_TEMPERATURE_UNIT);
    setDraftSport(null);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-outline-variant p-4 pb-4 md:p-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-on-surface">
            <Globe size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span
              aria-hidden="true"
              className="block font-display text-[9px] font-bold tracking-widest uppercase text-secondary"
            >
              {isOnboarding ? "First-time setup" : "Preferences"}
            </span>
            <h2
              id={titleId}
              className="font-display text-base font-bold tracking-wide uppercase truncate"
            >
              {isOnboarding ? "Set your defaults" : "Edit your defaults"}
            </h2>
          </div>
        </div>
        {!isOnboarding && (
          <button
            type="button"
            onClick={onSubmitEdit}
            aria-label="Close preferences"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant text-on-surface transition-colors hover:border-outline hover:bg-surface-container"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="px-2 md:px-6 pb-4 md:pb-6 space-y-6">
        <FieldGroup
          icon={<Ruler size={12} aria-hidden="true" />}
          label="Distance"
          htmlFor={`pref-distance-${mode}`}
        >
          <SegmentedControl
            id={`pref-distance-${mode}`}
            value={draftDistance}
            onChange={setDraftDistance}
            options={[
              { value: "mi", label: "Miles" },
              { value: "km", label: "Kilometers" },
            ]}
          />
        </FieldGroup>

        <FieldGroup
          icon={<Thermometer size={12} aria-hidden="true" />}
          label="Temperature"
          htmlFor={`pref-temp-${mode}`}
        >
          <SegmentedControl
            id={`pref-temp-${mode}`}
            value={draftTemp}
            onChange={setDraftTemp}
            options={[
              { value: "C", label: "Celsius" },
              { value: "F", label: "Fahrenheit" },
            ]}
          />
        </FieldGroup>

        <FieldGroup
          icon={<Activity size={12} aria-hidden="true" />}
          label="Sport preference"
          htmlFor={`pref-sport-${mode}`}
        >
          <ul
            id={`pref-sport-${mode}`}
            role="group"
            aria-label="Pick one discipline you ride"
            className="flex flex-wrap gap-1.5"
          >
            {SPORT_DISCIPLINES.map((sport) => {
              const active = draftSport === sport;
              return (
                <li key={sport}>
                  <label
                    className={cn(
                      "inline-flex cursor-pointer items-center rounded-full border px-3 py-2 text-[9px] font-bold tracking-widest uppercase transition-colors",
                      active
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-outline hover:bg-surface-container",
                    )}
                  >
                    <input
                      type="radio"
                      checked={active}
                      onChange={() => setDraftSport(sport)}
                      name={`pref-sport-${mode}`}
                      className="sr-only"
                      aria-label={sport}
                    />
                    {sport}
                  </label>
                </li>
              );
            })}
          </ul>
        </FieldGroup>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="min-h-11 flex-1 rounded-[9999px] border border-primary bg-primary px-6 text-xs font-bold tracking-widest text-on-primary uppercase transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {isOnboarding ? "Save & continue" : "Save changes"}
          </button>
          {!isOnboarding && (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-11 rounded-[9999px] border border-outline-variant bg-surface-container-high px-4 text-[10px] font-bold tracking-widest text-on-surface uppercase transition-colors hover:bg-surface-container-highest"
            >
              Reset
            </button>
          )}
        </div>

        {saveError ? (
          <p
            className="rounded-[8px] border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container"
            role="alert"
          >
            {saveError}
          </p>
        ) : null}

        {isOnboarding && (
          <p className="text-[10px] font-display text-secondary leading-snug">
            Choose one discipline. Signed-in riders get these preferences across
            devices.
          </p>
        )}
      </div>
    </>
  );
}

interface FieldGroupProps {
  icon: React.ReactNode;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldGroup({ icon, label, htmlFor, children }: FieldGroupProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 font-display text-[9px] font-bold tracking-widest uppercase text-secondary mb-2"
      >
        {icon}
        <span>{label}</span>
      </label>
      {children}
    </div>
  );
}

interface SegmentedControlProps<T extends string | number> {
  id: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}

function SegmentedControl<T extends string | number>({
  id,
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div
      id={id}
      role="radiogroup"
      className="grid grid-cols-2 overflow-hidden rounded-full border border-outline-variant divide-x divide-outline-variant"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-11 px-3 text-[11px] font-bold tracking-widest uppercase transition-colors",
              active
                ? "bg-primary text-on-primary"
                : "bg-surface-container-lowest text-on-surface hover:bg-surface-container",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
