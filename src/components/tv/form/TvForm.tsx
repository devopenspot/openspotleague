"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TV_CATEGORY_VALUES, type TvVideo, type TvCategory } from "@/types/tv";
import { parseYouTubeVideoUrl } from "@/lib/tv/urls";

const MAX_TV_CATEGORIES = 12;
const MAX_CATEGORY_LENGTH = 32;

function mergeCategories(
  existing: readonly TvCategory[],
  rawInput: string,
): { next: TvCategory[]; error?: string } {
  const tokens = rawInput
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return { next: [...existing] };

  const seen = new Set(existing.map((c) => c.toLowerCase()));
  const next = [...existing];
  for (const token of tokens) {
    if (token.length > MAX_CATEGORY_LENGTH) {
      return {
        next,
        error: `Each category must be ${MAX_CATEGORY_LENGTH} characters or fewer`,
      };
    }
    if (seen.has(token)) continue;
    if (next.length >= MAX_TV_CATEGORIES) {
      return {
        next,
        error: `Select at most ${MAX_TV_CATEGORIES} categories`,
      };
    }
    seen.add(token);
    next.push(token);
  }
  return { next };
}

export function TvForm({
  initial,
  disciplines,
  defaultDisciplineSlug,
  suggestedCategories,
  onDone,
}: {
  initial?: TvVideo | null;
  disciplines: readonly { slug: string; name: string }[];
  defaultDisciplineSlug?: string;
  suggestedCategories?: readonly string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(initial?.title ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl ?? "");
  const [disciplineSlug, setDisciplineSlug] = useState(
    initial?.disciplineSlug ?? defaultDisciplineSlug ?? disciplines[0]?.slug ?? "roller",
  );
  const [categories, setCategories] = useState<TvCategory[]>(() =>
    initial?.categories && initial.categories.length > 0
      ? [...initial.categories]
      : ["profile"],
  );
  const [categoryInput, setCategoryInput] = useState("");
  const [postDate, setPostDate] = useState(
    initial?.postDate
      ? initial.postDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [published, setPublished] = useState(initial?.published ?? true);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));

  const embedUrl = (() => {
    const p = parseYouTubeVideoUrl(youtubeUrl);
    return p?.embedUrl ?? null;
  })();

  const handleAddCategory = (raw = categoryInput) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const { next, error: mergeErr } = mergeCategories(categories, trimmed);
    if (mergeErr) {
      setFieldErrors((prev) => ({ ...prev, categories: mergeErr }));
      return;
    }
    setCategories(next);
    if (raw === categoryInput) setCategoryInput("");
    setFieldErrors((prev) => {
      if (!prev.categories) return prev;
      const copy = { ...prev };
      delete copy.categories;
      return copy;
    });
  };

  const handleRemoveCategory = (target: TvCategory) => {
    setCategories((prev) =>
      prev.filter((c) => c.toLowerCase() !== target.toLowerCase()),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    let finalCategories = categories;
    if (categoryInput.trim().length > 0) {
      const merged = mergeCategories(categories, categoryInput);
      if (merged.error) {
        setFieldErrors({ categories: merged.error });
        setError(merged.error);
        return;
      }
      finalCategories = merged.next;
      setCategories(finalCategories);
      setCategoryInput("");
    }

    if (finalCategories.length === 0) {
      setFieldErrors({ categories: "Add at least one category" });
      setError("At least one category is required");
      return;
    }

    const payload = {
      title: title.trim(),
      youtubeUrl: youtubeUrl.trim(),
      disciplineSlug: disciplineSlug.toLowerCase(),
      categories: finalCategories,
      postDate: new Date(postDate).toISOString(),
      published,
      sortOrder: Number(sortOrder) || 0,
    };
    if (!payload.title || !payload.youtubeUrl) {
      setError("Title and YouTube URL are required");
      return;
    }
    const urlParsed = parseYouTubeVideoUrl(payload.youtubeUrl);
    if (!urlParsed) {
      setFieldErrors({ youtubeUrl: "Enter a public YouTube video link" });
      return;
    }
    payload.youtubeUrl = urlParsed.canonicalUrl;

    startTransition(async () => {
      try {
        const isEdit = Boolean(initial?.id);
        const url = isEdit ? `/api/admin/tv/${initial!.id}` : "/api/admin/tv";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (isEdit && initial?.updatedAt)
          headers["If-Match"] = `"${initial.updatedAt}"`;
        const res = await fetch(url, {
          method: isEdit ? "PATCH" : "POST",
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.details?.fieldErrors) {
            const fe: Record<string, string> = {};
            for (const [k, v] of Object.entries(
              data.details.fieldErrors as Record<string, string[]>,
            )) {
              fe[k] = v?.[0] ?? "";
            }
            setFieldErrors(fe);
          }
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        if (onDone) onDone();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
    >
      {error ? (
        <div
          role="alert"
          className="rounded-card border border-error/40 bg-error-container px-3 py-2 text-xs text-on-error-container"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Title *
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base outline-none focus:border-primary sm:text-sm"
            placeholder="Video title"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            YouTube URL *
          </span>
          <input
            type="url"
            inputMode="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.youtubeUrl)}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base outline-none focus:border-primary sm:text-sm"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {fieldErrors.youtubeUrl ? (
            <span className="text-[11px] text-error">
              {fieldErrors.youtubeUrl}
            </span>
          ) : null}
          <span className="text-[11px] text-secondary">
            Supports youtube.com/watch, youtu.be/, embed, shorts
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Discipline *
          </span>
          <select
            value={disciplineSlug}
            onChange={(e) => setDisciplineSlug(e.target.value)}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base sm:text-sm"
          >
            {disciplines.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Post date *
          </span>
          <input
            type="date"
            value={postDate}
            onChange={(e) => setPostDate(e.target.value)}
            required
            className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base sm:text-sm"
          />
        </label>

        <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-3 md:col-span-2">
          <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Categories *
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={categoryInput}
              aria-label="Category input"
              aria-invalid={Boolean(fieldErrors.categories)}
              placeholder="Type a category and press Enter or Add (max 32)"
              maxLength={MAX_CATEGORY_LENGTH}
              onChange={(e) => setCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              className="min-h-11 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base text-on-surface outline-none focus:border-primary sm:text-sm"
            />
            <button
              type="button"
              aria-label="Add category"
              onClick={() => handleAddCategory()}
              disabled={
                categoryInput.trim().length === 0 ||
                categories.length >= MAX_TV_CATEGORIES
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div
            className="mt-2.5 flex flex-wrap items-center gap-1.5"
            aria-label="Suggested categories"
          >
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-secondary">
              Suggestions:
            </span>
            {(suggestedCategories && suggestedCategories.length > 0
              ? suggestedCategories
              : TV_CATEGORY_VALUES
            ).map((preset) => {
              const selected = categories.some(
                (c) => c.toLowerCase() === preset,
              );
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (selected) {
                      handleRemoveCategory(preset);
                    } else {
                      handleAddCategory(preset);
                    }
                  }}
                  className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow transition-colors ${
                    selected
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container-lowest text-secondary hover:border-outline hover:text-on-surface"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label="Selected categories"
          >
            {categories.length === 0 ? (
              <span className="text-xs leading-5 text-secondary">
                No categories — type or pick at least one category above.
              </span>
            ) : (
              categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest py-1 pl-3 pr-1.5 text-xs font-medium text-on-surface"
                >
                  {category}
                  <button
                    type="button"
                    aria-label={`Remove ${category}`}
                    onClick={() => handleRemoveCategory(category)}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-transparent text-xs font-bold text-secondary transition-colors hover:border-outline-variant hover:bg-surface-container-high hover:text-error focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span aria-hidden="true" className="leading-none">
                      ×
                    </span>
                  </button>
                </span>
              ))
            )}
          </div>
          {fieldErrors.categories ? (
            <p className="mt-1.5 text-[11px] text-error">
              {fieldErrors.categories}
            </p>
          ) : null}
          <p
            className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary"
            aria-live="polite"
          >
            {categories.length} selected · max {MAX_TV_CATEGORIES} · each ≤
            {MAX_CATEGORY_LENGTH}
          </p>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Display order (lower = first, ties: newest first)
          </span>
          <input
            type="number"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base sm:text-sm"
          />
        </label>
        <label className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Published
          </span>
        </label>
      </div>

      {embedUrl ? (
        <div className="overflow-hidden rounded-lg border border-outline-variant">
          <div className="aspect-video w-full bg-inverse-surface">
            <iframe
              src={embedUrl}
              title={title || "Preview"}
              className="h-full w-full"
              loading="lazy"
              allow="encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <p className="bg-surface-container-low px-3 py-1.5 font-display text-[10px] text-secondary">
            Preview — {embedUrl}
          </p>
        </div>
      ) : null}

      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:opacity-50"
        >
          {isPending ? "Saving…" : initial ? "Update video" : "Add video"}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-low active:scale-[0.99]"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
