"use client";

import { useEffect, useState } from "react";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { showToast } from "@/hooks/ui/useToast";
import type { Preferences } from "@/lib/schemas/preferences";

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
    void fetch("/api/preferences", { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<Preferences>;
      })
      .then(setPrefs)
      .catch(() => showToast("Preferences unavailable", "error"))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const patch = async (next: Partial<Preferences>) => {
    if (!prefs) return;
    const optimistic = { ...prefs, ...next };
    setPrefs(optimistic);
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
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
        <h3 className="font-display text-[13px] font-bold uppercase tracking-tight">
          Preferences
        </h3>
        <p className="mt-1 font-display text-[11px] uppercase tracking-widest text-secondary">
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
              className="block font-display text-[13px] font-semibold"
            >
              Main sport
            </label>
            <p className="font-display text-[11px] uppercase tracking-widest text-secondary">
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
              className="mt-2 w-full rounded-full border border-outline-variant bg-surface-container px-3 py-2.5 font-display text-[13px] font-semibold text-on-surface focus:outline-2 focus:outline-primary sm:rounded-[12px]"
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

      <div className="rounded-[12px] border border-outline-variant bg-surface-container p-3">
        <p className="font-display text-[11px] uppercase tracking-widest text-secondary">
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
        <div className="h-4 w-24 rounded bg-surface-container-high" />
        <div className="mt-2 h-3 w-64 rounded bg-surface-container-high" />
        <div className="mt-4 space-y-3">
          <div className="h-[68px] rounded-[12px] border border-outline-variant bg-surface-container-high" />
          <div className="h-[68px] rounded-[12px] border border-outline-variant bg-surface-container-high" />
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-surface-container-high" />
            <div className="h-3 w-48 rounded bg-surface-container-high" />
            <div className="mt-2 h-11 rounded-full border border-outline-variant bg-surface-container-high sm:rounded-[12px]" />
          </div>
        </div>
      </div>
      <div className="h-[52px] rounded-[12px] border border-outline-variant bg-surface-container-high" />
    </div>
  );
}
