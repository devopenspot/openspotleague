"use client";

import { useEffect, useId, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NominatimAddressPreview } from "./NominatimAddressPreview";
import type { ProjectedAddress } from "@/lib/geocode/project";

export type LatLonEditorMode = "auto-fill" | "preview" | "read-only";

interface LatLonEditorProps {
  lat: number;
  lon: number;
  onChange: (lat: number, lon: number) => void;
  /**
   * `auto-fill`  — the new-spot flow: a successful lookup's projected
   *                 address is forwarded to the parent via
   *                 `onAutoFillResult` so it can populate city / country /
   *                 address / citySlug. The address preview is also shown.
   * `preview`    — the edit flow: a successful lookup is shown as a
   *                 read-only preview; the parent is NOT notified, so
   *                 existing address fields are not overwritten.
   * `read-only`  — JSON mode / write-disabled: inputs and button are
   *                 disabled; no fetch is performed.
   */
  mode: LatLonEditorMode;
  /** Only invoked in `auto-fill` mode on a successful lookup. */
  onAutoFillResult?: (address: ProjectedAddress) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  resourceLabel?: string;
}

interface LookupState {
  status: "idle" | "loading" | "success" | "error";
  address: ProjectedAddress | null;
  error: string | null;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none disabled:opacity-50 sm:text-sm";

// Strict "lat, lon" parser. Optional surrounding whitespace, optional
// leading minus. Does NOT accept parens, DMS, or "lat lon" with no comma —
// those are rejected silently so the paste input feels honest.
const PASTE_REGEX = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function formatPaste(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${lat}, ${lon}`;
}

export function LatLonEditor({
  lat,
  lon,
  onChange,
  mode,
  onAutoFillResult,
  onError,
  disabled = false,
  required = false,
  invalid = false,
  resourceLabel = "spot",
}: LatLonEditorProps) {
  const pasteId = useId();
  const errorId = `${pasteId}-error`;
  const hintId = `${pasteId}-hint`;
  const readOnly = mode === "read-only" || disabled;
  const [state, setState] = useState<LookupState>({
    status: "idle",
    address: null,
    error: null,
  });
  // Local state for the paste field. Source of truth for the form is still
  // the `lat` / `lon` props; this just lets the user type freely without
  // losing their input on every keystroke.
  const [pasteValue, setPasteValue] = useState<string>(formatPaste(lat, lon));
  // Focus state. When focused and the underlying lat/lon are the (0, 0)
  // placeholder, the input is rendered empty so the native placeholder
  // shows and a fresh paste replaces nothing. Once the user has pasted
  // real coordinates, lat/lon become non-zero and the formatted value
  // stays visible across focus.
  const [isFocused, setIsFocused] = useState(false);

  // Resync the paste field when the two separate inputs change it externally.
  // This is the standard "derived state from props" pattern for a hybrid
  // controlled input (the user types freely, but prop changes win).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPasteValue(formatPaste(lat, lon));
  }, [lat, lon]);

  const setError = (message: string) => {
    setState({ status: "error", address: null, error: message });
    onError?.(message);
  };

  const handleLookup = async () => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError("Enter numeric latitude and longitude.");
      return;
    }
    if (lat === 0 && lon === 0) {
      setError(
        "Coordinates look like a placeholder (0, 0). Set real coordinates or paste from a map.",
      );
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError(
        "Coordinates out of range. Use lat ∈ [-90, 90] and lon ∈ [-180, 180].",
      );
      return;
    }
    setState({ status: "loading", address: null, error: null });
    try {
      const r = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        const message =
          r.status === 404
            ? "No address found at this location. Try moving the pin."
            : r.status >= 500
              ? "Reverse-geocode service is unavailable. Try again later."
              : (body?.error ?? `Reverse geocode failed (${r.status})`);
        setError(message);
        return;
      }
      const data = (await r.json()) as { address: ProjectedAddress };
      setState({ status: "success", address: data.address, error: null });
      if (mode === "auto-fill") {
        onAutoFillResult?.(data.address);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Reverse geocode failed";
      setError(message);
    }
  };

  const handleRetry = () => {
    setState({ status: "idle", address: null, error: null });
  };

  const handlePasteChange = (raw: string) => {
    setPasteValue(raw);
    const match = PASTE_REGEX.exec(raw);
    if (!match) return;
    const newLat = Number(match[1]);
    const newLon = Number(match[2]);
    if (Number.isFinite(newLat) && Number.isFinite(newLon)) {
      onChange(newLat, newLon);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!PASTE_REGEX.test(pasteValue)) {
      setPasteValue(formatPaste(lat, lon));
    }
  };

  const loading = state.status === "loading";
  const canLookup =
    !readOnly && !loading && Number.isFinite(lat) && Number.isFinite(lon);
  const showEmptyWhileFocused = isFocused && lat === 0 && lon === 0;
  const displayedValue = showEmptyWhileFocused ? "" : pasteValue;
  return (
    <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
      <legend className="flex items-center px-1 font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
        Location (lat / lon)
        {required ? <span className="ml-1 text-primary" aria-hidden="true">*</span> : null}
      </legend>
      <p className="mb-3 text-[10px] text-secondary">
        {mode === "auto-fill"
          ? `Paste coordinates from a map or type them. The location fields below auto-fill when the lookup succeeds; you can still edit them.`
          : `Latitude and longitude of the ${resourceLabel}. Use the button to reverse-geocode through Nominatim — the resolved address is shown as a preview without overwriting the location fields below.`}
      </p>

      <div className="mb-3">
        <label
          htmlFor={pasteId}
          className="mb-1 block font-display text-[10px] font-bold uppercase tracking-wider text-secondary"
        >
          <MapPin
            size={10}
            className="mr-1 inline-block align-middle"
            aria-hidden="true"
          />
          Paste coordinates (lat, lon)
        </label>
        <input
          id={pasteId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={displayedValue}
          onChange={(e) => handlePasteChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="3.4148330629420376, -76.55256421903898"
          disabled={readOnly}
          aria-required={required || undefined}
          aria-invalid={invalid || state.status === "error" || undefined}
          aria-describedby={invalid || state.status === "error" ? `${hintId} ${errorId}` : hintId}
          aria-busy={loading ? true : undefined}
          className={cn(FIELD_CLASSES, "font-display", (invalid || state.status === "error") && "border-error")}
        />

        <p
          id={hintId}
          className="mt-1 font-display text-[9px] uppercase tracking-widest text-secondary"
        >
          Strict format: <span className="font-semibold">lat, lon</span> · e.g.{" "}
          <span className="font-semibold">45.764, 4.836</span>
        </p>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={handleLookup}
          disabled={!canLookup}
          aria-busy={loading}
          aria-describedby={!canLookup && !readOnly ? hintId : undefined}
          title={!canLookup && !readOnly ? "Enter valid coordinates to look up" : undefined}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-on-primary transition-all hover:bg-surface-tint disabled:opacity-50 sm:w-auto"
        >
          <Search size={12} aria-hidden="true" />
          <span aria-live="polite">{loading ? "Looking up…" : "Look up"}</span>
        </button>
        {loading ? <span className="sr-only" aria-live="polite" aria-busy="true">Looking up address…</span> : null}
      </div>

      {state.status === "error" ? (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-error/30 bg-error-container/30 p-3 text-xs text-error"
        >
          <span>{state.error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-md border border-error/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state.status === "success" && state.address ? (
        <NominatimAddressPreview address={state.address} />
      ) : null}
    </fieldset>
  );
}
