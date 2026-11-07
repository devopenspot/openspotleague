"use client";

import { useId, useState } from "react";

import {
  CARD_NESTED,
  INPUT,
  LABEL,
  chipClass,
  controlClass,
} from "@/components/ui/recipes";
import type { Spot } from "@/lib/types";

type SpotTypeOption = { slug: string; name: string };

type Candidate = { id: string; name: string; city?: string | null };

export type QuickAddLocation = { lat: number; lon: number; accuracy: number };

/**
 * Inline "add this spot" for game setup. Takes the rider's current GPS fix,
 * a name, the spot types and one photo; the server fills the address from
 * the coordinates. The new spot starts personal (community rule: a second
 * rider checking in makes it public).
 */
export function QuickAddSpotForm({
  location,
  disciplineSlug,
  spotTypes,
  defaultSpotType,
  context,
  onCreated,
  parseSpot,
}: {
  location: QuickAddLocation | null;
  disciplineSlug: string;
  spotTypes: readonly SpotTypeOption[];
  defaultSpotType: string | null;
  context: "challenge" | "training";
  onCreated: (spot: Spot) => void;
  parseSpot: (value: unknown) => Spot;
}) {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [types, setTypes] = useState<string[]>(
    defaultSpotType ? [defaultSpotType] : [],
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  if (!open) {
    return (
      <div className={CARD_NESTED}>
        <p className="font-display text-sm font-bold uppercase">
          Not on the map yet?
        </p>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          {context === "challenge"
            ? "Add this place as a spot and battle here. It turns public when your opponent checks in, and leaderboard points count from then on."
            : "Add this place as a spot to keep your sessions together. It turns public once another rider checks in here."}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-3 ${controlClass("primary")}`}
        >
          Add this spot
        </button>
      </div>
    );
  }

  function toggleType(slug: string) {
    setTypes((current) =>
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug],
    );
    setError(null);
  }

  async function submit(confirm: boolean) {
    if (!location) {
      setError("We need your current location to add the spot.");
      return;
    }
    if (!name.trim()) {
      setError("Give the spot a name.");
      return;
    }
    if (types.length === 0) {
      setError("Pick at least one spot type.");
      return;
    }
    if (!file) {
      setError("Add one photo of the spot.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("autoAddress", "true");
      form.set("sports", disciplineSlug);
      form.set("types", types.join(","));
      form.set("lat", String(location.lat));
      form.set("lon", String(location.lon));
      form.set("accuracy", String(location.accuracy));
      form.set("confirm", confirm ? "true" : "false");
      form.set("image", file);
      const response = await fetch("/api/spots", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as {
        spot?: unknown;
        code?: string;
        candidates?: Candidate[];
        error?: string;
      } | null;
      if (response.status === 409 && data?.code === "NEARBY_CANDIDATES") {
        setCandidates(data.candidates ?? []);
        return;
      }
      if (!response.ok || !data?.spot) {
        setError(data?.error ?? "The spot could not be added. Try again.");
        return;
      }
      onCreated(parseSpot(data.spot));
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const nameId = `${baseId}-name`;
  const photoId = `${baseId}-photo`;
  const typesLabelId = `${baseId}-types`;

  return (
    <div className={`${CARD_NESTED} space-y-4`}>
      <p className="font-display text-sm font-bold uppercase">Add this spot</p>
      <div>
        <label htmlFor={nameId} className={LABEL}>
          Spot name
        </label>
        <input
          id={nameId}
          className={`mt-2 ${INPUT}`}
          value={name}
          maxLength={80}
          autoComplete="off"
          placeholder="e.g. Riverside ledges"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
      </div>
      <div>
        <p id={typesLabelId} className={LABEL}>
          Spot types
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-labelledby={typesLabelId}
        >
          {spotTypes.map((option) => (
            <button
              key={option.slug}
              type="button"
              aria-pressed={types.includes(option.slug)}
              onClick={() => toggleType(option.slug)}
              className={chipClass(types.includes(option.slug))}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={photoId} className={LABEL}>
          Photo
        </label>
        <input
          id={photoId}
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-2 block w-full text-base text-on-surface-variant sm:text-sm"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </div>
      <p className="text-xs leading-5 text-on-surface-variant">
        We use your current location for the address. New spots start
        personal and turn public once another rider checks in here.
      </p>
      {candidates && candidates.length > 0 ? (
        <div role="status" className="space-y-2">
          <p className="text-sm leading-6 text-on-surface">
            Spots already exist within 300 m:{" "}
            {candidates.map((candidate) => candidate.name).join(", ")}. They
            may not fit this game&apos;s spot types. Add yours anyway?
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(true)}
            className={controlClass("secondary")}
          >
            Yes, add my spot
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm leading-5 text-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
          className={controlClass("primary")}
        >
          {busy ? "Adding spot..." : "Save spot"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className={controlClass("outline")}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
