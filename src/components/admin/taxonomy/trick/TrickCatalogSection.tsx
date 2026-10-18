"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DeleteConfirmDialog } from "@/components/admin/common/DeleteConfirmDialog";
import type {
  TaxonomyEntry,
  TrickCatalog,
  TrickCatalogEntry,
} from "@/lib/repositories/taxonomy/taxonomy-repository";
import { showToast } from "@/hooks/ui/useToast";
import { adminRequest, getAdminErrorMessage } from "@/lib/admin/request";
import { useUser } from "@/lib/contexts/user-context";

type CatalogRow = Omit<TrickCatalog, "tricks"> & {
  tricks: TrickCatalogEntry[];
};

type PendingDelete = {
  kind: "trick";
  disciplineSlug: string;
  sourceId: string;
  label: string;
  description: string;
};

function trickKey(disciplineSlug: string, sourceId: string) {
  return `${disciplineSlug}:${sourceId}`;
}

export function TrickCatalogSection({
  sports,
  spotTypes,
  catalogs,
}: {
  sports: readonly TaxonomyEntry[];
  spotTypes: readonly TaxonomyEntry[];
  catalogs: readonly TrickCatalog[];
}) {
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>(() =>
    catalogs.map((catalog) => ({
      ...catalog,
      tricks: catalog.tricks.map((trick) => ({
        ...trick,
        compatibleSpotTypes: [...trick.compatibleSpotTypes],
        categories: [...(trick.categories ?? [])],
      })),
    })),
  );
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [newTrickIds, setNewTrickIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingTrickIds, setPendingTrickIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const catalog = useMemo(
    () => catalogRows.find((row) => row.disciplineSlug === selectedDiscipline) ?? null,
    [catalogRows, selectedDiscipline],
  );

  const user = useUser()
  const allowedDisciplineSlugs = useMemo(() => {
    if (!user || user.isAdministrator) return null
    const slugs = user.curatedDisciplineSlugs ?? []
    if (slugs.length === 0) return new Set<string>()
    return new Set(slugs.map((s) => s.toLowerCase()))
  }, [user])

  const baseDisciplineOptions = useMemo(
    () =>
      sports.length > 0
        ? sports
        : catalogRows.map((row) => ({
            slug: row.disciplineSlug,
            name: row.disciplineSlug,
            sortOrder: 0,
          })),
    [sports, catalogRows],
  )

  const disciplineOptions = useMemo(() => {
    if (allowedDisciplineSlugs === null) return baseDisciplineOptions
    return baseDisciplineOptions.filter((option) => allowedDisciplineSlugs.has(option.slug.toLowerCase()))
  }, [baseDisciplineOptions, allowedDisciplineSlugs])

  useEffect(() => {
    if (allowedDisciplineSlugs === null) return
    if (allowedDisciplineSlugs.size === 1 && !selectedDiscipline) {
      const only = [...allowedDisciplineSlugs][0]
      const match = disciplineOptions.find((o) => o.slug.toLowerCase() === only)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select single scoped sport for early block
      if (match) setSelectedDiscipline(match.slug)
    }
  }, [allowedDisciplineSlugs, disciplineOptions, selectedDiscipline])

  useEffect(() => {
    if (allowedDisciplineSlugs === null) return
    if (selectedDiscipline && !allowedDisciplineSlugs.has(selectedDiscipline.toLowerCase())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guard against manual URL/state tampering for early block
      setSelectedDiscipline("")
    }
  }, [allowedDisciplineSlugs, selectedDiscipline])

  function updateTrick(sourceId: string, patch: Partial<TrickCatalogEntry>) {
    if (!catalog) return;
    const disciplineSlug = catalog.disciplineSlug;
    setCatalogRows((rows) =>
      rows.map((row) =>
        row.disciplineSlug === disciplineSlug
          ? {
              ...row,
              tricks: row.tricks.map((trick) => (trick.sourceId === sourceId ? { ...trick, ...patch } : trick)),
            }
          : row,
      ),
    );
  }

  function setTrickPending(disciplineSlug: string, sourceId: string, pending: boolean) {
    const key = trickKey(disciplineSlug, sourceId);
    setPendingTrickIds((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function saveTrick(trick: TrickCatalogEntry) {
    if (!catalog) return;
    const disciplineSlug = catalog.disciplineSlug;
    const key = trickKey(disciplineSlug, trick.sourceId);
    if (!trick.name.trim() || !trick.description.trim() || trick.compatibleSpotTypes.length === 0) {
      showToast("Add a name, description, and compatible spot type before saving", "error");
      return;
    }
    const normalizedCategories = [...new Set(trick.categories.map((c) => c.trim().toLowerCase()).filter((c) => c.length > 0))].sort();
    if (normalizedCategories.length !== trick.categories.length) {
      showToast("Categories must be unique (case-insensitive) and non-empty", "error");
      return;
    }
    if (normalizedCategories.some((c) => c.length > 32)) {
      showToast("Each category must be at most 32 characters", "error");
      return;
    }
    if (normalizedCategories.length > 12) {
      showToast("A trick can have at most 12 categories", "error");
      return;
    }

    setTrickPending(disciplineSlug, trick.sourceId, true);
    try {
      // Use the freshest catalog row in case a previous save updated state but `catalog` closure is stale.
      const freshCatalog = catalogRows.find((row) => row.disciplineSlug === disciplineSlug) ?? catalog;
      let nextUpdatedAt = freshCatalog.updatedAt;
      const saved = (await adminRequest(
        `/api/admin/trick-catalogs/${encodeURIComponent(disciplineSlug)}/tricks/${encodeURIComponent(trick.sourceId)}`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...(freshCatalog.updatedAt ? { "If-Match": `"${freshCatalog.updatedAt}"` } : {}),
          },
          body: JSON.stringify({
            ...trick,
            name: trick.name.trim(),
            description: trick.description.trim(),
            categories: [...new Set(trick.categories.map((c) => c.trim().toLowerCase()).filter((c) => c.length > 0))].sort(),
          }),
        },
        (response) => {
          const rawEtag = response.headers?.get?.("etag") ?? response.headers?.get?.("ETag") ?? null;
          const etag = rawEtag?.replace(/^W\//, "").replace(/^"|"$/g, "");
          if (etag) nextUpdatedAt = etag;
        },
      )) as TrickCatalogEntry & { updatedAt?: string };
      const bodyUpdatedAt = (saved as { updatedAt?: string }).updatedAt;
      if (bodyUpdatedAt) nextUpdatedAt = bodyUpdatedAt;
      setCatalogRows((rows) =>
        rows.map((row) =>
          row.disciplineSlug === disciplineSlug
            ? {
                ...row,
                updatedAt: nextUpdatedAt,
                tricks: row.tricks.map((item) =>
                  item.sourceId === trick.sourceId
                    ? {
                        ...saved,
                        compatibleSpotTypes: [...saved.compatibleSpotTypes],
                        categories: [...(saved.categories ?? [])],
                      }
                    : item,
                ),
              }
            : row,
        ),
      );
      setNewTrickIds((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      showToast("Trick saved", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Trick could not be saved"), "error");
    } finally {
      setTrickPending(disciplineSlug, trick.sourceId, false);
    }
  }

  function removeTrick(sourceId: string) {
    if (!catalog) return;
    const disciplineSlug = catalog.disciplineSlug;
    const key = trickKey(disciplineSlug, sourceId);
    const isNew = newTrickIds.has(key);
    const persistedTrickCount = catalog.tricks.filter(
      (trick) => !newTrickIds.has(trickKey(disciplineSlug, trick.sourceId)),
    ).length;
    if (!isNew && persistedTrickCount <= 1) return;
    const trick = catalog.tricks.find((item) => item.sourceId === sourceId);
    if (!trick) return;
    setPendingDelete({
      kind: "trick",
      disciplineSlug,
      sourceId,
      label: trick.name,
      description: isNew
        ? `Discard "${trick.name}"? This unsaved row will be removed.`
        : `Delete "${trick.name}" from the ${disciplineSlug} catalog? This cannot be undone.`,
    });
  }

  async function deleteTrick(disciplineSlug: string, sourceId: string) {
    const selectedCatalog = catalogRows.find((row) => row.disciplineSlug === disciplineSlug);
    if (!selectedCatalog) return;
    const key = trickKey(disciplineSlug, sourceId);
    const isNew = newTrickIds.has(key);
    if (isNew) {
      setCatalogRows((rows) =>
        rows.map((row) =>
          row.disciplineSlug === disciplineSlug
            ? {
                ...row,
                tricks: row.tricks.filter((trick) => trick.sourceId !== sourceId),
              }
            : row,
        ),
      );
      setNewTrickIds((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      return;
    }

    setTrickPending(disciplineSlug, sourceId, true);
    try {
      const freshCatalog = catalogRows.find((row) => row.disciplineSlug === disciplineSlug) ?? selectedCatalog;
      let nextUpdatedAt = freshCatalog.updatedAt;
      await adminRequest(
        `/api/admin/trick-catalogs/${encodeURIComponent(disciplineSlug)}/tricks/${encodeURIComponent(sourceId)}`,
        {
          method: "DELETE",
          headers: freshCatalog.updatedAt ? { "If-Match": `"${freshCatalog.updatedAt}"` } : undefined,
        },
        (response) => {
          const rawEtag = response.headers?.get?.("etag") ?? response.headers?.get?.("ETag") ?? null;
          const etag = rawEtag?.replace(/^W\//, "").replace(/^"|"$/g, "");
          if (etag) nextUpdatedAt = etag;
        },
      );
      setCatalogRows((rows) =>
        rows.map((row) =>
          row.disciplineSlug === disciplineSlug
            ? {
                ...row,
                updatedAt: nextUpdatedAt,
                tricks: row.tricks.filter((trick) => trick.sourceId !== sourceId),
              }
            : row,
        ),
      );
      showToast("Trick deleted", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Trick could not be deleted"), "error");
    } finally {
      setTrickPending(disciplineSlug, sourceId, false);
    }
  }

  async function confirmDelete() {
    const current = pendingDelete;
    if (!current) return;
    await deleteTrick(current.disciplineSlug, current.sourceId);
    setPendingDelete(null);
  }

  function addTrick() {
    if (!catalog) return;
    const randomId = crypto.randomUUID();
    const sourceId = `admin-${randomId}`;
    const key = trickKey(catalog.disciplineSlug, sourceId);
    setCatalogRows((rows) =>
      rows.map((row) =>
        row.disciplineSlug === catalog.disciplineSlug
          ? {
              ...row,
              tricks: [
                ...row.tricks,
                {
                  sourceId,
                  name: "New trick",
                  description: "Describe the trick.",
                  level: 1 as const,
                  compatibleSpotTypes: [],
                  categories: [],
                },
              ],
            }
          : row,
      ),
    );
    setNewTrickIds((current) => new Set(current).add(key));
  }

  function toggleTrickSpotType(sourceId: string, spotTypeSlug: string) {
    if (!catalog) return;
    const currentTrick = catalog.tricks.find((trick) => trick.sourceId === sourceId);
    if (!currentTrick) return;
    updateTrick(sourceId, {
      compatibleSpotTypes: currentTrick.compatibleSpotTypes.includes(spotTypeSlug)
        ? currentTrick.compatibleSpotTypes.filter((slug) => slug !== spotTypeSlug)
        : [...currentTrick.compatibleSpotTypes, spotTypeSlug],
    });
  }

  function addTrickCategory(sourceId: string) {
    if (!catalog) return;
    const raw = (categoryInputs[sourceId] ?? "").trim();
    if (!raw) return;
    if (raw.length > 32) {
      showToast("Category must be at most 32 characters", "error");
      return;
    }
    const normalized = raw.toLowerCase();
    const currentTrick = catalog.tricks.find((trick) => trick.sourceId === sourceId);
    if (!currentTrick) return;
    const existing = new Set(currentTrick.categories.map((c) => c.toLowerCase()));
    if (existing.has(normalized)) {
      showToast("Category already added", "error");
      return;
    }
    if (currentTrick.categories.length >= 12) {
      showToast("A trick can have at most 12 categories", "error");
      return;
    }
    updateTrick(sourceId, { categories: [...currentTrick.categories, normalized].sort() });
    setCategoryInputs((prev) => ({ ...prev, [sourceId]: "" }));
  }

  function removeTrickCategory(sourceId: string, category: string) {
    if (!catalog) return;
    const currentTrick = catalog.tricks.find((trick) => trick.sourceId === sourceId);
    if (!currentTrick) return;
    updateTrick(sourceId, {
      categories: currentTrick.categories.filter((c) => c.toLowerCase() !== category.toLowerCase()),
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={selectedDiscipline}
          onChange={(event) => setSelectedDiscipline(event.target.value)}
          aria-label="Select sport"
          className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-primary focus:outline-none sm:text-sm"
        >
          <option value="">Select a sport…</option>
          {disciplineOptions.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addTrick}
          disabled={!catalog}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add trick
        </button>
      </div>
      {catalog ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-sm text-secondary">
            <span className="font-bold text-on-surface tabular-nums">
              {catalog.tricks.length} trick{catalog.tricks.length === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Version {catalog.version ?? "not versioned"}</span>
            <span aria-hidden="true">·</span>
            <span>
              Last updated <time dateTime={catalog.updatedAt ?? catalog.createdAt}>{catalog.updatedAt ?? catalog.createdAt}</time>
            </span>
          </div>
          <p className="text-sm leading-6 text-on-surface-variant">Save changes one trick at a time. New tricks are drafts until their row is saved.</p>
        </>
      ) : allowedDisciplineSlugs !== null && disciplineOptions.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-6 text-center"
        >
          <p className="font-display text-lg font-bold tracking-tight text-on-surface">No trick catalogs available for your account</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
            {allowedDisciplineSlugs.size === 0
              ? "You don't have any discipline scopes assigned. Ask an administrator to grant you a sport like roller."
              : `You are scoped to ${[...allowedDisciplineSlugs].join(", ")} — other sports are hidden. If this is wrong, contact an administrator.`}
          </p>
        </div>
      ) : (
        <div
          role="status"
          className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-6 text-center"
        >
          <p className="font-display text-lg font-bold tracking-tight text-on-surface">No initialized catalog for this sport</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
            This sport does not have a supported trick catalog yet. Choose another sport to edit its tricks.
          </p>
        </div>
      )}
      {catalog
        ? catalog.tricks.map((trick) => {
            const key = trickKey(catalog.disciplineSlug, trick.sourceId);
            const isNew = newTrickIds.has(key);
            const pending = pendingTrickIds.has(key);
            const valid =
              trick.name.trim().length > 0 &&
              trick.description.trim().length > 0 &&
              trick.compatibleSpotTypes.length > 0 &&
              trick.categories.every((c) => c.trim().length > 0 && c.trim().length <= 32) &&
              new Set(trick.categories.map((c) => c.toLowerCase())).size === trick.categories.length &&
              trick.categories.length <= 12;
            const persistedTrickCount = catalog.tricks.filter(
              (item) => !newTrickIds.has(trickKey(catalog.disciplineSlug, item.sourceId)),
            ).length;
            const canDelete = isNew || persistedTrickCount > 1;
            return (
              <div
                key={trick.sourceId}
                aria-busy={pending}
                className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
              >
                <div className="grid gap-2 sm:grid-cols-[8rem_1fr_6rem_auto]">
                  <code className="rounded-md bg-surface-container-low p-2 text-xs text-on-surface-variant">{trick.sourceId}</code>
                  <input
                    value={trick.name}
                    aria-label={`${trick.sourceId} name`}
                    onChange={(event) => updateTrick(trick.sourceId, { name: event.target.value })}
                    className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base text-on-surface focus:border-primary focus:outline-none sm:text-sm"
                  />
                  <select
                    value={trick.level}
                    aria-label={`${trick.sourceId} level`}
                    onChange={(event) =>
                      updateTrick(trick.sourceId, { level: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })
                    }
                    className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base text-on-surface focus:border-primary focus:outline-none sm:text-sm"
                  >
                    <option value={1}>Level 1</option>
                    <option value={2}>Level 2</option>
                    <option value={3}>Level 3</option>
                    <option value={4}>Level 4</option>
                    <option value={5}>Level 5</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Save ${trick.name}`}
                      disabled={!valid || pending}
                      onClick={() => void saveTrick(trick)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${trick.name}`}
                      disabled={!canDelete || pending}
                      onClick={() => void removeTrick(trick.sourceId)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-error bg-surface-container-lowest px-5 py-2 text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={trick.description}
                  aria-label={`${trick.sourceId} description`}
                  onChange={(event) => updateTrick(trick.sourceId, { description: event.target.value })}
                  className="min-h-20 w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base text-on-surface focus:border-primary focus:outline-none sm:text-sm"
                />
                <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                    Compatible spot types
                  </legend>
                  <div className="flex flex-wrap gap-1.5" aria-label={`${trick.sourceId} compatible spot types`}>
                    {spotTypes.map((spotType) => {
                      const active = trick.compatibleSpotTypes.includes(spotType.slug);
                      return (
                        <button
                          key={spotType.slug}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTrickSpotType(trick.sourceId, spotType.slug)}
                          className={cn(
                            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.99]",
                            active
                              ? "border-primary bg-primary text-on-primary"
                              : "border-outline-variant bg-surface-container-lowest text-secondary hover:border-outline hover:text-on-surface",
                          )}
                        >
                          {spotType.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary" aria-live="polite">
                    {trick.compatibleSpotTypes.length} selected
                  </p>
                </fieldset>
                <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                    Categories
                  </legend>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={categoryInputs[trick.sourceId] ?? ""}
                      aria-label={`${trick.sourceId} category input`}
                      placeholder="Add category (max 32)"
                      maxLength={32}
                      onChange={(event) => setCategoryInputs((prev) => ({ ...prev, [trick.sourceId]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTrickCategory(trick.sourceId);
                        }
                      }}
                      className="min-h-11 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base text-on-surface focus:border-primary focus:outline-none sm:text-sm"
                    />
                    <button
                      type="button"
                      aria-label={`Add category to ${trick.sourceId}`}
                      onClick={() => addTrickCategory(trick.sourceId)}
                      disabled={(categoryInputs[trick.sourceId] ?? "").trim().length === 0}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`${trick.sourceId} categories`}>
                    {trick.categories.length === 0 ? (
                      <span className="text-xs leading-5 text-secondary">No categories — add at least one via the input above.</span>
                    ) : (
                      trick.categories.map((category) => (
                        <span
                          key={category}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest py-1 pl-3 pr-1.5 text-xs font-medium text-on-surface"
                        >
                          {category}
                          <button
                            type="button"
                            aria-label={`Remove ${category} from ${trick.sourceId}`}
                            onClick={() => removeTrickCategory(trick.sourceId, category)}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-transparent text-xs font-bold text-secondary transition-colors hover:border-outline-variant hover:bg-surface-container-high hover:text-error focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <span aria-hidden="true" className="leading-none">×</span>
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary" aria-live="polite">
                    {trick.categories.length} selected · max 12 · each ≤32
                  </p>
                </fieldset>
              </div>
            );
          })
        : null}
      <DeleteConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Remove trick"
        description={pendingDelete?.description ?? ""}
        confirmLabel="Confirm"
      />
    </section>
  );
}
