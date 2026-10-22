"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, ShieldCheck, Loader2 } from "lucide-react";
import { useCurrentLocation } from "@/hooks/data/useCurrentLocation";
import { useUser } from "@/lib/contexts/user-context";
import { FieldError, FormLabel, ImageDropzone, LocationGate, NearbySheet, TextInput } from "./form-parts";
import type { Spot } from "@/lib/types";
import { COMMUNITY_RADIUS_METERS } from "@/lib/config/constants";

type FormErrors = Partial<Record<"name" | "city" | "address" | "country" | "location" | "image" | "sports" | "types" | "general", string>>;

export default function SpotCreateForm() {
  const router = useRouter();
  const user = useUser();
  const { status, location, error: locError, request } = useCurrentLocation();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("Spain");
  const [instagram, setInstagram] = useState("");
  const [sports, setSports] = useState<string[]>(["skateboard"]);
  const [types, setTypes] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [spotTypes, setSpotTypes] = useState<Array<{ slug: string; name: string }>>([]);
  const [nearby, setNearby] = useState<readonly Spot[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/spot-types", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSpotTypes((d.items ?? []) as Array<{ slug: string; name: string }>))
      .catch(() => setSpotTypes([]));
  }, []);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preview URL sync is intentional
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const fetchNearby = async () => {
    if (!location) return;
    try {
      const res = await fetch(`/api/spots?near=${location.lat},${location.lon},${COMMUNITY_RADIUS_METERS}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const items = (data.items ?? []) as Spot[];
        setNearby(items);
        if (items.length > 0 && !confirm) {
          setErrors((e) => ({ ...e, general: `${items.length} nearby spot(s) within 300 m — check below.` }));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch nearby on location grant
    if (status === "granted" && location) void fetchNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, location?.lat, location?.lon]);

  const toggle = (arr: string[], value: string, setter: (v: string[]) => void) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!city.trim()) next.city = "City is required.";
    if (!address.trim()) next.address = "Address is required.";
    if (!country.trim()) next.country = "Country is required.";
    if (!location) next.location = "Current location is required.";
    else if (location.accuracy > 100) next.location = "Accuracy too low. Move outdoors.";
    if (!file) next.image = "Image is required.";
    if (sports.length === 0) next.sports = "Pick at least one sport.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleVerify = async (spotId: string) => {
    if (!user?.id) return;
    const res = await fetch("/api/verified-spots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spotId }) });
    if (res.ok) {
      router.push(`/spots/${spotId}`);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;
    if (!location || !file) return;
    if (nearby && nearby.length > 0 && !confirm) {
      setErrors((err) => ({ ...err, general: "Confirm you checked nearby spots, or verify one of them." }));
      document.getElementById("nearby-sheet")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("city", city.trim());
      fd.set("address", address.trim());
      fd.set("country", country.trim());
      fd.set("sports", sports.join(","));
      fd.set("types", types.join(","));
      if (instagram.trim()) fd.set("instagram", instagram.trim());
      fd.set("lat", String(location.lat));
      fd.set("lon", String(location.lon));
      fd.set("accuracy", String(location.accuracy));
      fd.set("confirm", confirm ? "true" : "false");
      fd.set("image", file);

      const res = await fetch("/api/spots", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === "NEARBY_CANDIDATES") {
        setNearby((data.candidates ?? []) as Spot[]);
        setConfirm(false);
        setErrors((er) => ({ ...er, general: "We found nearby spots within 300 m. Verify one or confirm to create anyway." }));
        setBusy(false);
        return;
      }
      if (!res.ok) {
        setGeneralError(data?.error ?? "Could not create spot.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/saved?filter=created"), 800);
    } catch {
      setGeneralError("Network error. Try again.");
      setBusy(false);
    }
  };

  const sportsOptions = useMemo(() => ["roller", "skateboard", "bmx", "scooter"], []);

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-6 px-5 py-6 sm:px-6">
      <header className="space-y-2">
        <span className="block font-sans text-xs font-semibold uppercase tracking-[0.05em] text-secondary">Add a spot</span>
        <h1 className="font-display text-3xl font-bold uppercase tracking-[-0.02em] text-on-surface">New spot from your location</h1>
        <p className="text-sm leading-6 text-on-surface-variant">Spots start as personal — only you see them. When a second rider adds a spot within 300 m, both become public with a Community badge. Anonymous by design.</p>
      </header>

      <LocationGate status={status} error={locError} location={location} onRequest={request} />
      {errors.location ? <FieldError message={errors.location} /> : null}

      {nearby !== null ? (
        <div id="nearby-sheet">
          <NearbySheet candidates={nearby} onVerify={handleVerify} onDismiss={() => { setConfirm(true); setNearby([]); setErrors((er) => ({ ...er, general: undefined })); }} />
        </div>
      ) : null}

      <div className="space-y-5 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
        <div>
          <FormLabel htmlFor="spot-name" required>Spot name</FormLabel>
          <TextInput id="spot-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="PLAZA MAYOR LEDGE" error={errors.name} className="mt-2 uppercase" />
          <FieldError message={errors.name} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormLabel htmlFor="spot-city" required>City</FormLabel>
            <TextInput id="spot-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Barcelona" error={errors.city} className="mt-2" />
            <FieldError message={errors.city} />
          </div>
          <div>
            <FormLabel htmlFor="spot-country" required>Country</FormLabel>
            <TextInput id="spot-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Spain" error={errors.country} className="mt-2" />
            <FieldError message={errors.country} />
          </div>
        </div>

        <div>
          <FormLabel htmlFor="spot-address" required>Address</FormLabel>
          <TextInput id="spot-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Carrer de ... 123" error={errors.address} className="mt-2" />
          <FieldError message={errors.address} />
        </div>

        <div>
          <FormLabel htmlFor="spot-instagram">Instagram URL</FormLabel>
          <TextInput id="spot-instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." className="mt-2" inputMode="url" />
        </div>

        <div>
          <p className="block font-sans text-xs font-semibold uppercase tracking-[0.05em] text-on-surface">Sports <span className="text-error">*</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sportsOptions.map((s) => (
              <button key={s} type="button" aria-pressed={sports.includes(s)} onClick={() => toggle(sports, s, setSports)} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide ${sports.includes(s) ? "bg-primary border-primary text-on-primary" : "bg-surface border-outline-variant text-on-surface"}`}>{s}</button>
            ))}
          </div>
          <FieldError message={errors.sports} />
        </div>

        <div>
          <p className="block font-sans text-xs font-semibold uppercase tracking-[0.05em] text-on-surface">Spot types</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {spotTypes.map((t) => (
              <button key={t.slug} type="button" aria-pressed={types.includes(t.slug)} onClick={() => toggle(types, t.slug, setTypes)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${types.includes(t.slug) ? "bg-primary border-primary text-on-primary" : "bg-surface border-outline-variant text-on-surface"}`}>{t.name}</button>
            ))}
          </div>
        </div>

        <div>
          <FormLabel htmlFor="spot-image" required>Photo</FormLabel>
          <div className="mt-2">
            <ImageDropzone file={file} preview={preview} error={errors.image} onFile={setFile} onRemove={() => setFile(null)} />
          </div>
          <FieldError message={errors.image} />
        </div>
      </div>

      {errors.general ? <p role="alert" className="rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">{errors.general}</p> : null}
      {generalError ? <p role="alert" className="rounded-[8px] bg-error-container px-3 py-2 text-xs text-on-error-container">{generalError}</p> : null}

      {success ? <p role="status" className="rounded-[8px] bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800 flex gap-2 items-center"><ShieldCheck size={14} aria-hidden /> Spot created — redirecting to Saved…</p> : null}

      <button type="submit" disabled={busy || success} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9999px] bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-on-primary disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Compass size={14} aria-hidden />}
        {busy ? "Creating…" : "Create spot"}
      </button>

      <p className="text-center text-xs text-on-surface-variant leading-relaxed">
        By creating, you confirm you have permission to photograph this spot, respect private property, and agree to OpenSpot's{" "}
        <Link href="/terms#ugc" target="_blank" className="font-semibold underline hover:text-on-surface">
          UGC Terms
        </Link>
        . Personal until verified by the community.
      </p>
    </form>
  );
}
