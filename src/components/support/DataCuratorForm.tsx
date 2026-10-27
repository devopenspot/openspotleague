"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { MapPin, Trophy, Tv, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface CountryOption {
  iso2: string;
  name: string;
}

type CuratorKind = "spots" | "tv" | "tricks";
type Visibility = "team" | "anonymous";

const KINDS: { id: CuratorKind; title: string; body: string; icon: LucideIcon }[] = [
  { id: "spots", title: "Spots", body: "Edit spots in your countries.", icon: MapPin },
  { id: "tv", title: "TV videos", body: "Curate TV videos by discipline.", icon: Tv },
  { id: "tricks", title: "Tricks", body: "Maintain trick catalogs by discipline.", icon: Trophy },
];

// Section headings are h2 elements inside each fieldset; the fieldset is named via aria-labelledby.
const fieldsetClass = "rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5";
const headingClass =
  "font-display text-lg font-bold uppercase leading-[1.3] tracking-[-0.02em] text-on-surface";

const inputClass =
  "min-h-11 w-full rounded-[12px] border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base text-on-surface placeholder:text-secondary sm:text-sm focus-visible:outline-offset-2";

export function DataCuratorForm({ countries }: { countries: CountryOption[] }) {
  const [kinds, setKinds] = useState<CuratorKind[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("anonymous");
  const [displayName, setDisplayName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const wantsSpots = kinds.includes("spots");
  const namesByIso = useMemo(() => new Map(countries.map((c) => [c.iso2, c.name])), [countries]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? countries.filter((c) => c.name.toLowerCase().includes(q)) : countries;
  }, [countries, query]);

  const errors: string[] = [];
  if (kinds.length === 0) errors.push("Choose at least one kind of data curator.");
  if (wantsSpots && selected.length === 0) errors.push("Choose at least one country for spots.");
  if (visibility === "team" && displayName.trim().length === 0) errors.push("Add the name to show in the team.");
  if (!acknowledged) errors.push("Confirm you have read the guidelines.");
  const isValid = errors.length === 0;

  const toggleKind = (id: CuratorKind) => {
    setSubmitted(false);
    setKinds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };
  const toggleCountry = (iso2: string) => {
    setSubmitted(false);
    setSelected((prev) => (prev.includes(iso2) ? prev.filter((c) => c !== iso2) : [...prev, iso2]));
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isValid) setSubmitted(true);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset className={fieldsetClass} aria-labelledby="kinds-title">
        <h2 id="kinds-title" className={headingClass}>Kind of data curator</h2>
        <p className="mt-1 text-sm leading-5 text-on-surface-variant">Choose one or more.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {KINDS.map(({ id, title, body, icon: Icon }) => {
            const checked = kinds.includes(id);
            return (
              <label
                key={id}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col gap-2 rounded-[14px] border p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
                  checked ? "border-primary bg-surface-container-high" : "border-outline-variant bg-surface-container-lowest hover:border-outline",
                )}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleKind(id)} />
                <span className="flex items-center justify-between">
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={cn("h-4 w-4 rounded-md border border-primary", checked ? "bg-primary" : "bg-transparent")}
                  />
                </span>
                <span className="font-display text-base font-bold uppercase tracking-[-0.02em]">{title}</span>
                <span className="text-xs leading-4 text-on-surface-variant">{body}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {wantsSpots ? (
        <fieldset className={fieldsetClass} aria-labelledby="countries-title">
          <h2 id="countries-title" className={headingClass}>Countries for spots</h2>
          <p className="mt-1 text-sm leading-5 text-on-surface-variant">
            Where will you contribute? <span className="font-semibold text-on-surface">{selected.length} selected</span>
          </p>
          {selected.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {selected.map((iso2) => (
                <li key={iso2}>
                  <button
                    type="button"
                    onClick={() => toggleCountry(iso2)}
                    aria-label={`Remove ${namesByIso.get(iso2) ?? iso2}`}
                    className="inline-flex min-h-8 items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-on-primary"
                  >
                    {namesByIso.get(iso2) ?? iso2} <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label htmlFor="country-filter" className="sr-only">
            Filter countries
          </label>
          <input
            id="country-filter"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter countries…"
            className={cn(inputClass, "mt-3")}
          />
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-[12px] border border-outline-variant">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-on-surface-variant">No countries match.</li>
            ) : (
              filtered.map(({ iso2, name }) => (
                <li key={iso2} className="border-b border-outline-variant last:border-b-0">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      checked={selected.includes(iso2)}
                      onChange={() => toggleCountry(iso2)}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <span>{name}</span>
                    <span className="ml-auto font-mono text-[10px] font-bold tracking-widest text-secondary">{iso2}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </fieldset>
      ) : null}

      <fieldset className={fieldsetClass} aria-labelledby="visibility-title">
        <h2 id="visibility-title" className={headingClass}>Visibility</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(
            [
              { id: "anonymous", title: "Stay anonymous", body: "Support without being listed." },
              { id: "team", title: "Show me in the team", body: "List my name on the data curators team." },
            ] as const
          ).map(({ id, title, body }) => (
            <label
              key={id}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border p-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
                visibility === id ? "border-primary bg-surface-container-high" : "border-outline-variant hover:border-outline",
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={id}
                checked={visibility === id}
                onChange={() => {
                  setSubmitted(false);
                  setVisibility(id);
                }}
                className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
              />
              <span>
                <span className="block font-display text-sm font-bold uppercase tracking-[-0.02em]">{title}</span>
                <span className="block text-xs leading-4 text-on-surface-variant">{body}</span>
              </span>
            </label>
          ))}
        </div>
        {visibility === "team" ? (
          <div className="mt-3">
            <label htmlFor="display-name" className="font-sans text-xs font-semibold tracking-[0.05em] uppercase">
              Name to show
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder="How should we list you?"
              className={cn(inputClass, "mt-1")}
            />
          </div>
        ) : null}
      </fieldset>

      <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-5">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              setSubmitted(false);
              setAcknowledged(e.target.checked);
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          />
          <span>
            I have read the{" "}
            <Link href="/support#guidelines" className="font-semibold underline underline-offset-4">
              data curation guidelines
            </Link>
            .
          </span>
        </label>

        {!isValid ? (
          <ul id="form-hints" className="mt-3 grid gap-1 text-xs leading-4 text-on-surface-variant">
            {errors.map((message) => (
              <li key={message}>• {message}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!isValid}
            aria-describedby={isValid ? undefined : "form-hints"}
            className="inline-flex min-h-11 items-center rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit application
          </button>
          <Link
            href="/support"
            className="inline-flex min-h-11 items-center rounded-[9999px] border border-outline-variant bg-surface-container-high px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] uppercase transition-colors hover:border-outline focus-visible:outline-offset-4"
          >
            Cancel
          </Link>
        </div>

        {submitted ? (
          <p role="status" className="mt-4 rounded-[12px] border border-outline-variant bg-surface-container-low px-3 py-2 text-sm leading-5">
            Preview only — applications aren&apos;t connected yet. Nothing was sent.
          </p>
        ) : null}
      </div>
    </form>
  );
}
