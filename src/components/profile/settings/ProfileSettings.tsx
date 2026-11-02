"use client";

import { useEffect, useState } from "react";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { showToast } from "@/hooks/ui/useToast";
import {
  PROFILE_BODY_CLASS,
  PROFILE_CARD_TITLE_CLASS,
} from "@/components/profile/profile-styles";
import type { Preferences } from "@/lib/schemas/preferences";
import { fetchWithTimeout } from "@/lib/utils/fetch-timeout";

const DEFAULT_PREFERENCES: Preferences = {
  distanceUnit: "mi",
  temperatureUnit: "F",
  disciplineSlug: null,
};

const SPORTS: readonly { slug: string; label: string }[] = [
  { slug: "skateboard", label: "Skateboard" },
  { slug: "roller", label: "Roller" },
  { slug: "bmx", label: "BMX" },
  { slug: "scooter", label: "Scooter" },
];

export function ProfileSettings() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchWithTimeout("/api/preferences", {
      signal: ctrl.signal,
      timeoutMs: 10_000,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<Preferences>;
      })
      .then((data) => {
        if (!ctrl.signal.aborted) setPrefs(data);
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setPrefs((prev) => prev ?? DEFAULT_PREFERENCES);
        showToast("Preferences unavailable", "error");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  const patch = async (next: Partial<Preferences>) => {
    if (!prefs) return;
    const optimistic = { ...prefs, ...next };
    setPrefs(optimistic);
    setSaving(true);
    try {
      const res = await fetchWithTimeout("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
        timeoutMs: 10_000,
      });
      if (!res.ok) throw new Error("save failed");
      const saved = (await res.json()) as Preferences;
      setPrefs(saved);
      showToast("Saved ✓", "success");
    } catch {
      setPrefs(prefs);
      showToast("Couldn’t save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return <ProfileSettingsSkeleton />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className={PROFILE_CARD_TITLE_CLASS}>Preferences</h3>
        <p className={`mt-1 ${PROFILE_BODY_CLASS}`}>
          Units & sport — saved instantly, syncs to weather & distances
        </p>

        <div className="mt-4 space-y-3">
          <ToggleSwitch
            checked={prefs.distanceUnit === "km"}
            onChange={(checked) =>
              patch({ distanceUnit: checked ? "km" : "mi" })
            }
            label={`Distance — ${prefs.distanceUnit === "km" ? "Kilometers" : "Miles"}`}
            description="Switch between KM and MI for map and spot distances"
            disabled={saving}
            id="pref-distance"
          />

          <ToggleSwitch
            checked={prefs.temperatureUnit === "F"}
            onChange={(checked) =>
              patch({ temperatureUnit: checked ? "F" : "C" })
            }
            label={`Temperature — ${prefs.temperatureUnit === "C" ? "Celsius" : "Fahrenheit"}`}
            description="Affects weather shown on spots and map"
            disabled={saving}
            id="pref-temp"
          />

          <div>
            <label
              htmlFor="pref-sport"
              className="block font-display text-sm font-semibold"
            >
              Main sport
            </label>
            <p className={PROFILE_BODY_CLASS}>
              Used for League and spot suggestions
            </p>
            <select
              id="pref-sport"
              value={prefs.disciplineSlug ?? ""}
              onChange={(e) =>
                patch({
                  disciplineSlug: e.target.value
                    ? (e.target.value as Preferences["disciplineSlug"])
                    : null,
                })
              }
              disabled={saving}
              className="mt-2 min-h-12 w-full rounded-lg border-2 border-outline-variant bg-surface-container px-3 font-display text-base font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"
            >
              <option value="">No preference</option>
              {SPORTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container p-3">
        <p className={PROFILE_BODY_CLASS}>
          Tip: preferences apply everywhere — map distances, weather header, and
          game suggestions update right away.
        </p>
      </div>
    </div>
  );
}

export function ProfileSettingsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3 ">
      <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
        <div className="h-7 w-40 rounded bg-surface-container-high" />
        <div className="mt-1 h-5 w-64 max-w-full rounded bg-surface-container-high" />
        <div className="mt-4 space-y-3">
          <div className="h-[86px] rounded-lg border-2 border-outline-variant bg-surface-container-high sm:h-[66px]" />
          <div className="h-[86px] rounded-lg border-2 border-outline-variant bg-surface-container-high sm:h-[66px]" />
          <div>
            <div className="h-5 w-20 rounded bg-surface-container-high" />
            <div className="h-5 w-56 max-w-full rounded bg-surface-container-high" />
            <div className="mt-2 h-12 rounded-lg border-2 border-outline-variant bg-surface-container-high" />
          </div>
        </div>
      </div>
      <div className="h-[86px] rounded-lg border border-outline-variant bg-surface-container-high sm:h-[46px]" />
    </div>
  );
}
