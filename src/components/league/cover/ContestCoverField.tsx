"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { ContestCover } from "@/components/league/landing/ContestCover";
import { FieldLabel, FieldMessages } from "@/components/league/form-parts";
import { controlClass } from "@/components/ui/recipes";
import {
  CONTEST_COVER_ACCEPT,
  DEFAULT_CONTEST_IMAGE,
  contestCoverError,
  hasContestCover,
} from "@/lib/league/cover";
import type { SportDiscipline } from "@/types/disciplines";

interface ContestCoverFieldProps {
  id: string;
  /** Newly picked file, not uploaded yet. */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Stored cover; the designed fallback renders when there is none. */
  currentImage?: string;
  /** Shown only when a stored cover exists and no new file is picked. */
  onRemoveCurrent?: () => void;
  categoryName: string;
  sports: readonly SportDiscipline[];
  disabled?: boolean;
  hint?: string;
}

/**
 * Cover picker with a live preview in the card's 16:9-ish frame. Validation
 * mirrors the storage rules (type + 5 MB) so most rejects never hit the
 * network; the route still validates.
 */
export function ContestCoverField({
  id,
  file,
  onFileChange,
  currentImage = DEFAULT_CONTEST_IMAGE,
  onRemoveCurrent,
  categoryName,
  sports,
  disabled = false,
  hint = "Optional — PNG, JPG, WebP or AVIF up to 5 MB. Without one, the contest gets a designed cover.",
}: ContestCoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesId = useId();
  // Object URL for the unsent file; revoked when the file changes or unmounts.
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function pick(next: File | null) {
    if (!next) return;
    const message = contestCoverError(next);
    setError(message);
    if (!message) onFileChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownImage = previewUrl ?? currentImage;
  const hasStored = !file && hasContestCover(currentImage);

  return (
    <div className="sm:col-span-2">
      <FieldLabel htmlFor={id}>Cover image</FieldLabel>
      <div className="relative h-40 w-full overflow-hidden rounded-card border border-outline-variant bg-on-surface sm:h-48">
        {previewUrl ? (
          // Object URL preview of an unsent file: plain img, not AppImage.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected cover preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <ContestCover
            image={shownImage}
            categoryName={categoryName}
            sports={sports}
            sizes="(min-width: 768px) 640px, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={CONTEST_COVER_ACCEPT}
          disabled={disabled}
          className="sr-only"
          aria-describedby={`${messagesId}-hint`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={controlClass("outline", "sm")}
        >
          <ImagePlus size={14} aria-hidden="true" />
          {file || hasStored ? "Replace image" : "Choose image"}
        </button>
        {file ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError(null);
              onFileChange(null);
            }}
            className={controlClass("outline", "sm")}
          >
            Discard
          </button>
        ) : hasStored && onRemoveCurrent ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemoveCurrent}
            className={controlClass("outline", "sm")}
          >
            <Trash2 size={14} aria-hidden="true" />
            Remove cover
          </button>
        ) : null}
      </div>
      <FieldMessages id={messagesId} hint={hint} error={error ?? undefined} />
    </div>
  );
}
