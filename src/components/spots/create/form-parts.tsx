"use client";

import Image from "next/image";
import { AppImage } from "@/components/ui/AppImage";
import { Image as ImageIcon, X, MapPin, Navigation, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Spot } from "@/lib/types";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-error" role="alert">{message}</p>;
}

export function FormLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase">
      {children} {required ? <span className="text-error" aria-hidden>*</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const { error, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        "w-full rounded-[12px] border bg-surface-container-lowest px-4 py-3 text-base sm:text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
        error ? "border-error" : "border-outline-variant",
        className,
      )}
    />
  );
}

export function ImageDropzone({
  file,
  preview,
  error,
  onFile,
  onRemove,
}: {
  file: File | null;
  preview: string | null;
  error?: string;
  onFile: (f: File | null) => void;
  onRemove: () => void;
}) {
  if (file && preview) {
    return (
      <div className="relative h-64 w-full overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-lowest">
        <Image
          src={preview}
          alt="Selected spot preview"
          fill
          sizes="(min-width: 640px) 40rem, 100vw"
          unoptimized
          className="object-cover"
        />
        <button type="button" onClick={onRemove} aria-label="Remove image" className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-on-surface shadow border border-outline-variant">
          <X size={14} aria-hidden />
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-on-surface/70 to-transparent p-3">
          <p className="text-xs text-surface truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed bg-surface-container-lowest px-6 py-10 text-center cursor-pointer transition-colors",
        "border-outline-variant hover:border-on-surface-variant",
        error ? "border-error" : "",
      )}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Spot image"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) onFile(f);
        }}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high border border-outline-variant">
        <ImageIcon size={16} aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-on-surface">Tap to select image</p>
      <p className="mt-1 text-xs text-on-surface-variant">PNG, JPG, WebP or AVIF · up to 5 MB · min 32×32</p>
      {error ? <p className="mt-2 text-xs text-error">{error}</p> : null}
    </label>
  );
}

export function LocationGate({
  status,
  error,
  location,
  onRequest,
}: {
  status: "idle" | "requesting" | "granted" | "denied" | "unavailable";
  error: string | null;
  location: { lat: number; lon: number; accuracy: number } | null;
  onRequest: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
          <Navigation size={14} aria-hidden />
        </div>
        <div>
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface">Current location</h3>
          <p className="text-xs text-on-surface-variant">Required to prevent duplicates. We check 300 m around you.</p>
        </div>
      </div>

      {status === "granted" && location ? (
        <div className="mt-4 rounded-[12px] bg-surface-container-high border border-outline-variant px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
            <MapPin size={12} aria-hidden /> {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">Accuracy: ±{Math.round(location.accuracy)} m {location.accuracy > 100 ? <span className="text-error">(too low — move outdoors)</span> : <span className="text-secondary">· good</span>}</p>
        </div>
      ) : null}

      {status !== "granted" ? (
        <button type="button" onClick={onRequest} disabled={status === "requesting"} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9999px] bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-on-primary disabled:opacity-50">
          <Navigation size={14} aria-hidden /> {status === "requesting" ? "Requesting…" : "Use my current location"}
        </button>
      ) : (
        <button type="button" onClick={onRequest} className="mt-3 text-xs underline text-on-surface-variant">Refresh location</button>
      )}

      {error ? <p role="alert" className="mt-3 flex gap-2 rounded-[8px] bg-error-container px-3 py-2 text-xs text-on-error-container"><ShieldAlert size={14} className="shrink-0 mt-0.5" aria-hidden /> <span>{error}</span></p> : null}
    </div>
  );
}

export function NearbySheet({
  candidates,
  onVerify,
  onDismiss,
}: {
  candidates: readonly Spot[];
  onVerify: (id: string) => void;
  onDismiss: () => void;
}) {
  if (candidates.length === 0) return null;
  return (
    <div role="alert" aria-live="polite" className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <h3 className="font-display text-xs font-bold uppercase tracking-[0.05em] text-amber-900">Nearby spots within 300 m</h3>
      <p className="mt-1 text-xs leading-5 text-amber-800">We found {candidates.length} spot{candidates.length > 1 ? "s" : ""} very close to you. Is yours one of these? Verifying helps keep the directory clean.</p>
      <div className="mt-4 grid gap-3">
        {candidates.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-[12px] border border-amber-200 bg-white p-3">
            <AppImage src={s.image} alt={s.name} width={48} height={48} className="h-12 w-12 rounded-[8px] object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">{s.name}</p>
              <p className="truncate text-xs text-on-surface-variant">{s.city} · {s.address}</p>
            </div>
            <button type="button" onClick={() => onVerify(s.id)} className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-primary">Verify</button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onDismiss} className="flex-1 rounded-full border border-amber-300 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-amber-900">Not these — create new anyway</button>
      </div>
    </div>
  );
}
