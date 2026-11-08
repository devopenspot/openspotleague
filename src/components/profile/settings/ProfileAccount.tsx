"use client";

import { useState, type ReactNode } from "react";
import { Activity, Ruler, Thermometer } from "lucide-react";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { showToast } from "@/hooks/ui/useToast";
import { useSavePreferences, type PreferenceValues } from "@/hooks/preferences/useSavePreferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { SPORT_PREFERENCES, type SportPreference } from "@/types/disciplines";
import { BODY, CARD, CARD_TITLE, META, SEGMENTED_TRACK, chipClass, segmentClass } from "@/components/ui/recipes";
import type { ProfileSummary } from "@/lib/services/profile/profile";

type SaveStatus = "idle" | "saving" | "saved";

const DISTANCE_OPTIONS = [
  { value: "mi", label: "Miles" },
  { value: "km", label: "Kilometers" },
] as const;

const TEMPERATURE_OPTIONS = [
  { value: "C", label: "Celsius °C" },
  { value: "F", label: "Fahrenheit °F" },
] as const;

function sportLabel(sport: SportPreference): string {
  return sport === "all" ? "All sports" : sport;
}

function Field({
  icon,
  label,
  labelId,
  hint,
  children,
}: {
  icon: ReactNode;
  label: string;
  labelId: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p id={labelId} className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
        {icon} {label}
      </p>
      <p className={BODY}>{hint}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Preferences read from and written to the app-wide store through the same
 * writer as the Preferences dialog, so map distances and weather follow at once.
 */
function PreferencesCard() {
  const save = useSavePreferences();
  const hydrationStatus = usePreferencesStore((s) => s.hydrationStatus);
  const distanceUnit = usePreferencesStore((s) => s.distanceUnit);
  const temperatureUnit = usePreferencesStore((s) => s.temperatureUnit);
  const preferredSport = usePreferencesStore((s) => s.preferredSport);
  // The value being saved, shown right away; the store takes over once the server confirms.
  const [pending, setPending] = useState<PreferenceValues | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const ready = hydrationStatus === "ready" || hydrationStatus === "error";
  const shown: PreferenceValues = pending ?? { distanceUnit, temperatureUnit, preferredSport };
  const busy = !ready || status === "saving";

  const update = async (patch: Partial<PreferenceValues>) => {
    const next = { ...shown, ...patch };
    setPending(next);
    setStatus("saving");
    try {
      await save(next);
      setStatus("saved");
    } catch {
      setStatus("idle");
      showToast("Couldn’t save your preferences", "error");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={CARD} aria-labelledby="profile-preferences" aria-busy={busy}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="profile-preferences" className={CARD_TITLE}>
          Preferences
        </h2>
        <p className={META} aria-live="polite">
          {!ready ? "Loading…" : status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </p>
      </div>
      <p className={`mt-1 ${BODY}`}>Used across the map, spot weather and game suggestions.</p>

      <div className="mt-4 space-y-5">
        <Field icon={<Ruler size={16} aria-hidden="true" />} label="Distance" labelId="pref-distance" hint="Map and spot distances.">
          <div role="group" aria-labelledby="pref-distance" className={`sm:max-w-sm ${SEGMENTED_TRACK}`}>
            {DISTANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={shown.distanceUnit === opt.value}
                disabled={busy}
                onClick={() => shown.distanceUnit !== opt.value && void update({ distanceUnit: opt.value })}
                className={`${segmentClass(shown.distanceUnit === opt.value)} disabled:cursor-not-allowed`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          icon={<Thermometer size={16} aria-hidden="true" />}
          label="Temperature"
          labelId="pref-temperature"
          hint="Weather on spots and the map."
        >
          <div role="group" aria-labelledby="pref-temperature" className={`sm:max-w-sm ${SEGMENTED_TRACK}`}>
            {TEMPERATURE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={shown.temperatureUnit === opt.value}
                disabled={busy}
                onClick={() => shown.temperatureUnit !== opt.value && void update({ temperatureUnit: opt.value })}
                className={`${segmentClass(shown.temperatureUnit === opt.value)} disabled:cursor-not-allowed`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          icon={<Activity size={16} aria-hidden="true" />}
          label="Main sport"
          labelId="pref-sport"
          hint="Which spots, games and contests we suggest first."
        >
          <div role="group" aria-labelledby="pref-sport" className="flex flex-wrap gap-2">
            {SPORT_PREFERENCES.map((sport) => (
              <button
                key={sport}
                type="button"
                aria-pressed={shown.preferredSport === sport}
                disabled={busy}
                onClick={() => shown.preferredSport !== sport && void update({ preferredSport: sport })}
                className={`${chipClass(shown.preferredSport === sport)} disabled:cursor-not-allowed`}
              >
                {sportLabel(sport)}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </section>
  );
}

/** Account tab: preferences, then who is signed in and the way out. */
export function ProfileAccount({ user }: { user: ProfileSummary["user"] }) {
  return (
    <div className="space-y-4">
      <PreferencesCard />
      <section className={CARD} aria-labelledby="profile-account">
        <h2 id="profile-account" className={CARD_TITLE}>
          Account
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {user.name ? (
              <p className="truncate font-display text-sm font-semibold text-on-surface">{user.name}</p>
            ) : null}
            <p className={`truncate ${BODY}`}>{user.email}</p>
          </div>
          <SignOutButton variant="profile" />
        </div>
      </section>
    </div>
  );
}
