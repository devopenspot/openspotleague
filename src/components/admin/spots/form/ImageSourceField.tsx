"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_CLIENT_DIMENSION = 2048;
const MIN_CLIENT_DIMENSION = 32;
const MAX_IMAGE_DIMENSION = 4000;
const CLIENT_WEBP_QUALITY = 0.82;
const ALLOWED_CLIENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

async function compressImageFile(file: File): Promise<File> {
  // Free client-side resize before upload: avoids sending 5 MB originals.
  // Uses browser canvas, no deps. Falls back to original file on any error.
  try {
    if (typeof window === "undefined" || typeof document === "undefined") return file
    if (typeof createImageBitmap === "undefined") return file
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    // If already small and webp/avif, skip
    if (
      width <= MAX_CLIENT_DIMENSION &&
      height <= MAX_CLIENT_DIMENSION &&
      (file.type === "image/webp" || file.type === "image/avif") &&
      file.size < 600 * 1024
    ) {
      bitmap.close()
      return file
    }
    const scale = Math.min(1, MAX_CLIENT_DIMENSION / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    bitmap.close()
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", CLIENT_WEBP_QUALITY))
    if (!blob || blob.size === 0) return file
    // Keep original if compressed is larger (e.g., tiny PNG)
    if (blob.size >= file.size) return file
    const newName = file.name.replace(/\.[^.]+$/, ".webp") || "image.webp"
    return new File([blob], newName, { type: "image/webp" })
  } catch {
    return file
  }
}

export interface ImageSourceFieldValue {
  imageUrl: string;
  file: File | null;
}

interface ImageSourceFieldProps {
  value: ImageSourceFieldValue;
  onChange: (value: ImageSourceFieldValue) => void;
  /** Disable the file input (e.g. in JSON mode). */
  disabled?: boolean;
}

/**
 * Visual banner source — shared by spots + events, create + edit.
 * Supports 4 interchangeable sources: file upload, paste image (Ctrl+V),
 * drag & drop, and hotlink URL. All file sources are validated and
 * compressed client-side before upload; URL ingestion is handled server-side.
 */
export function ImageSourceField({
  value,
  onChange,
  disabled = false,
}: ImageSourceFieldProps) {
  const fileId = useId();
  const imageId = useId();
  const previewUrlRef = useRef<string | null>(null);
  const compressSeqRef = useRef(0);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleCustomUrl = (url: string) => {
    setError(null);
    onChange({ imageUrl: url, file: value.file });
  };

  const processPickedFile = async (next: File, inputEl?: HTMLInputElement | null) => {
    if (!ALLOWED_CLIENT_TYPES.has(next.type)) {
      setError("Only PNG, JPG, WebP and AVIF images are supported");
      if (inputEl) inputEl.value = "";
      return;
    }
    if (next.size <= 0 || next.size > MAX_UPLOAD_BYTES) {
      setError("Images must be between 1 byte and 5 MB");
      if (inputEl) inputEl.value = "";
      return;
    }
    // Instant dimension check — mirrors server 32–4000 guard
    try {
      if (typeof createImageBitmap !== "undefined") {
        const bmp = await createImageBitmap(next);
        const { width, height } = bmp;
        bmp.close();
        if (width === 0 || height === 0) {
          setError("Invalid image dimensions");
          if (inputEl) inputEl.value = "";
          return;
        }
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          setError(`Image dimensions too large (max ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION})`);
          if (inputEl) inputEl.value = "";
          return;
        }
        if (width < MIN_CLIENT_DIMENSION || height < MIN_CLIENT_DIMENSION) {
          setError(`Image too small (min ${MIN_CLIENT_DIMENSION}x${MIN_CLIENT_DIMENSION})`);
          if (inputEl) inputEl.value = "";
          return;
        }
      }
    } catch {
      // bitmap check is best-effort — fall through to upload
    }
    setError(null);
    const seq = (compressSeqRef.current += 1);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const immediateUrl = URL.createObjectURL(next);
    previewUrlRef.current = immediateUrl;
    setFilePreview(immediateUrl);

    const compressed = await compressImageFile(next);
    if (compressSeqRef.current !== seq) return;
    if (compressed.size > MAX_UPLOAD_BYTES) {
      setError(`Compressed image is still too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB). Try a smaller file.`);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setFilePreview(null);
      onChange({ imageUrl: value.imageUrl, file: null });
      if (inputEl) inputEl.value = "";
      return;
    }
    if (compressed === next) {
      onChange({ imageUrl: value.imageUrl, file: next });
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(compressed);
    previewUrlRef.current = url;
    setFilePreview(url);
    onChange({ imageUrl: value.imageUrl, file: compressed });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const next = inputEl.files?.[0] ?? null;
    if (!next) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setFilePreview(null);
      onChange({ imageUrl: value.imageUrl, file: null });
      return;
    }
    await processPickedFile(next, inputEl);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (disabled) return;
    const clipboard = e.clipboardData;
    if (!clipboard) return;
    // 1) File from clipboard (copy/paste image, screenshot)
    let file: File | null = null;
    if (clipboard.items) {
      for (const item of Array.from(clipboard.items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f && ALLOWED_CLIENT_TYPES.has(f.type)) {
            file = f;
            break;
          }
          // Fallback: accept any image/* but surface unified error via processPickedFile
          if (f && f.type.startsWith("image/")) {
            file = f;
            break;
          }
        }
      }
    }
    if (!file && clipboard.files && clipboard.files.length > 0) {
      const f = clipboard.files[0];
      if (f && (ALLOWED_CLIENT_TYPES.has(f.type) || f.type.startsWith("image/"))) file = f;
    }
    if (file) {
      e.preventDefault();
      await processPickedFile(file);
      return;
    }
    // 2) URL string pasted outside the text input (e.g. copy image address -> paste on fieldset)
    // Let the URL input handle its own paste; only intercept if target is not the URL input
    const target = e.target as HTMLElement | null;
    if (target && target.id === imageId) return;
    const text = clipboard.getData("text").trim();
    if (text && /^https?:\/\//i.test(text)) {
      // Avoid hijacking plain text pastes elsewhere
      if (text.length < 2048) {
        e.preventDefault();
        handleCustomUrl(text);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file && (ALLOWED_CLIENT_TYPES.has(file.type) || file.type.startsWith("image/"))) {
      await processPickedFile(file);
      return;
    }
    // Show unified error for unsupported dropped image type
    if (file && file.type) {
      setError("Only PNG, JPG, WebP and AVIF images are supported");
      return;
    }
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url && /^https?:\/\//i.test(url.trim())) {
      handleCustomUrl(url.trim());
    }
  };

  const handleClearFile = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setFilePreview(null);
    onChange({ imageUrl: value.imageUrl, file: null });
    // Reset file input so picking the same file again fires onChange
    const el = document.getElementById(fileId) as HTMLInputElement | null
    if (el) el.value = ""
  };

  return (
    <fieldset
      onPaste={handlePaste}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border bg-surface-container-low p-5 transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-outline-variant",
      )}
    >
      <legend className="flex items-center px-1 font-display text-[10px] font-bold uppercase tracking-wider text-secondary">
        <ImageIcon size={12} className="mr-1.5" aria-hidden="true" />
        Visual banner source
      </legend>
      <p className="mb-3 text-[10px] leading-relaxed text-secondary">
        PNG, JPG, WebP, AVIF • max 5 MB • 32–4000 px • stored as 2048 px WebP (variants 128/400/800). Choose a file, paste an image (Ctrl+V / Cmd+V), drag & drop, or paste a URL — all interchangeable.
      </p>

      <div className="mb-3">
          <label
            htmlFor={fileId}
            className="mb-1 block text-[10px] font-display font-semibold text-secondary"
          >
            Upload your own photo — or paste / drop here
          </label>
        <div className="flex items-center gap-2">
          <label
            htmlFor={fileId}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-low active:scale-[0.99]",
              !disabled && "hover:bg-surface-container-low",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <Upload size={13} aria-hidden="true" />
            <span>Choose file</span>
          </label>
          <input
            id={fileId}
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={handleFileChange}
            disabled={disabled}
            className="sr-only"
          />
          {value.file ? (
            <button
              type="button"
              onClick={handleClearFile}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary hover:text-error"
            >
              <X size={12} aria-hidden="true" />
              <span>Clear</span>
            </button>
          ) : null}
        </div>
        {filePreview ? (
          <div className="relative mt-3 h-32 w-full max-w-sm overflow-hidden rounded-lg border border-outline-variant">
            <Image
              src={filePreview}
              alt="Selected upload preview"
              fill
              sizes="(min-width: 640px) 24rem, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={imageId}
          className="mb-1 block text-[10px] font-display font-semibold text-secondary"
        >
          Or specify custom image URL
        </label>
        <input
          id={imageId}
          type="url"
          placeholder="Paste custom hotlink image URL here..."
          value={value.imageUrl}
          onChange={(e) => handleCustomUrl(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none sm:text-sm"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-card border border-error/40 bg-error-container px-3 py-2 text-xs text-on-error-container"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
