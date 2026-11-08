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
import type { SportPreference } from "@/types/disciplines";
import { useSavePreferences } from "@/hooks/preferences/useSavePreferences";
import { useUser } from "@/lib/contexts/user-context";
import { SignInLink } from "@/components/shell/SignInLink";
import {
  CARD_TITLE,
  EYEBROW,
  LABEL,
  SEGMENTED_TRACK,
  alertClass,
  chipClass,
  controlClass,
  iconButtonClass,
  segmentClass,
} from "@/components/ui/recipes";

const ONBOARDING_DIALOG_TITLE_ID = "onboarding-dialog-title";

const SPORT_OPTIONS: ReadonlyArray<{ value: SportPreference; label: string }> =
  [
    { value: "all", label: "All disciplines" },
    { value: "Skateboard", label: "Skateboard" },
    { value: "BMX", label: "BMX" },
    { value: "Scooter", label: "Scooter" },
    { value: "Roller", label: "Roller" },
  ];

type Mode = "onboarding" | "edit";

export function OnboardingDialog() {
  const titleId = useId() || ONBOARDING_DIALOG_TITLE_ID;
  const isOpen = useUIStore((s) => s.isOnboardingOpen);
  const mode = useUIStore((s) => s.preferenceDialogMode);
  const closeOnboarding = useUIStore((s) => s.closeOnboarding);
  const pendingAction = useUIStore((s) => s.pendingOnboardingAction);
  const pendingNext = useUIStore((s) => s.pendingOnboardingNext);

  const savePreferences = useSavePreferences();
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
      panelClassName="max-w-md overflow-hidden border border-outline-variant bg-surface-container-lowest"
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
          onSave={(distanceUnit, temperatureUnit, preferredSport) =>
            savePreferences({ distanceUnit, temperatureUnit, preferredSport })
          }
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
            variant="dialog"
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
    sport: SportPreference | null,
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
  const [draftSport, setDraftSport] = useState<SportPreference | null>(
    initial.preferredSport,
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isOnboarding && !draftSport) {
      setSaveError("Choose a sport or select all to continue.");
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
          <span className="flex h-control w-control shrink-0 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-on-surface">
            <Globe size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span aria-hidden="true" className={`block ${EYEBROW}`}>
              {isOnboarding ? "First-time setup" : "Preferences"}
            </span>
            <h2
              id={titleId}
              className={`truncate ${CARD_TITLE} text-on-surface`}
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
            className={iconButtonClass("outline")}
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
            aria-label="Pick one discipline you ride or select all"
            className="flex flex-wrap gap-1.5"
          >
            {SPORT_OPTIONS.map((opt) => {
              const active = draftSport === opt.value;
              return (
                <li key={opt.value}>
                  <label
                    className={`cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${chipClass(active)}`}
                  >
                    <input
                      type="radio"
                      checked={active}
                      onChange={() => setDraftSport(opt.value)}
                      name={`pref-sport-${mode}`}
                      className="sr-only"
                      aria-label={opt.label}
                    />
                    {opt.label}
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
            className={`flex-1 ${controlClass("primary")}`}
          >
            {isOnboarding ? "Save & continue" : "Save changes"}
          </button>
          {!isOnboarding && (
            <button
              type="button"
              onClick={handleReset}
              className={controlClass("secondary")}
            >
              Reset
            </button>
          )}
        </div>

        {saveError ? (
          <p className={`text-xs ${alertClass("error")}`} role="alert">
            {saveError}
          </p>
        ) : null}

        {isOnboarding && (
          <p className="text-[10px] font-display text-secondary leading-snug">
            Choose one discipline or select all. Signed-in riders get these
            preferences across devices.
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
        className={`mb-2 flex items-center gap-1.5 ${LABEL}`}
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
    <div id={id} role="radiogroup" className={SEGMENTED_TRACK}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={segmentClass(active)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
