"use client";

/**
 * Admin plan table (`league.manage`): price/caps/monthly-limit editor.
 * Existing slugs are edit-only (payments + account plans RESTRICT the slug);
 * new pricing tiers ship as new slugs via the create form.
 */

import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MANAGE_CONTROL_CLASSES } from "@/components/league/manage/manage-parts";
import { money } from "@/lib/league/ui-state";

interface PlanItem {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  maxRiders: number;
  maxJudges: number;
  maxOrganizers: number;
  monthlyEventLimit: number;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
}

interface EditablePatch {
  name: string;
  priceCents: string;
  maxRiders: string;
  maxJudges: string;
  maxOrganizers: string;
  monthlyEventLimit: string;
  isDefault: boolean;
  active: boolean;
}

function toEditable(plan?: PlanItem): EditablePatch {
  if (!plan) {
    return {
      name: "",
      priceCents: "0",
      maxRiders: "3",
      maxJudges: "0",
      maxOrganizers: "1",
      monthlyEventLimit: "8",
      isDefault: false,
      active: true,
    };
  }
  return {
    name: plan.name,
    priceCents: String(plan.priceCents),
    maxRiders: String(plan.maxRiders),
    maxJudges: String(plan.maxJudges),
    maxOrganizers: String(plan.maxOrganizers),
    monthlyEventLimit: String(plan.monthlyEventLimit),
    isDefault: plan.isDefault,
    active: plan.active,
  };
}

export function AdminLeaguePlansTable() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditablePatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<{
    slug: string;
    patch: EditablePatch;
  }>({ slug: "", patch: toEditable() });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const response = await fetch("/api/admin/league/plans", {
        cache: "no-store",
      });
      if (cancelled) return;
      if (response.ok) {
        const data = (await response.json()) as { items: PlanItem[] };
        setItems(data.items);
      } else {
        setError("Plans could not be loaded.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(
    slug: string,
    patch: Record<string, unknown>,
    isNew: boolean,
  ) {
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(
        isNew ? "/api/admin/league/plans" : `/api/admin/league/plans/${slug}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isNew ? { slug, ...patch } : patch),
        },
      );
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(raw?.message ?? raw?.error ?? "Save failed.");
        return;
      }
      const saved = raw as PlanItem;
      if (isNew) {
        setItems((current) =>
          [...current, saved].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setCreating(false);
        setCreateDraft({ slug: "", patch: toEditable() });
      } else {
        setItems((current) =>
          current.map((item) => (item.slug === slug ? saved : item)),
        );
        setEditingSlug(null);
        setDraft(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const numberField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={MANAGE_CONTROL_CLASSES}
      />
    </label>
  );

  const patchFromDraft = (): Record<string, unknown> => ({
    name: draft!.name,
    priceCents: Number(draft!.priceCents) || 0,
    maxRiders: Number(draft!.maxRiders) || 0,
    maxJudges: Number(draft!.maxJudges) || 0,
    maxOrganizers: Number(draft!.maxOrganizers) || 0,
    monthlyEventLimit: Number(draft!.monthlyEventLimit) || 1,
    isDefault: draft!.isDefault,
    active: draft!.active,
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          Plans set per-event capacity and the monthly creation limit.
        </p>
        <button
          type="button"
          onClick={() => setCreating((current) => !current)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface hover:border-outline"
        >
          {creating ? (
            <X size={12} aria-hidden="true" />
          ) : (
            <Plus size={12} aria-hidden="true" />
          )}
          {creating ? "Cancel" : "New plan"}
        </button>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {actionError}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {error}
        </div>
      ) : null}

      {creating ? (
        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <label className="flex flex-col gap-1">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
              Slug (immutable)
            </span>
            <input
              value={createDraft.slug}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  slug: event.target.value.toLowerCase(),
                }))
              }
              placeholder="starter-plus"
              className={MANAGE_CONTROL_CLASSES}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
              Name
            </span>
            <input
              value={createDraft.patch.name}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  patch: { ...current.patch, name: event.target.value },
                }))
              }
              className={MANAGE_CONTROL_CLASSES}
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {numberField(
              "Price (cents)",
              createDraft.patch.priceCents,
              (value) =>
                setCreateDraft((current) => ({
                  ...current,
                  patch: { ...current.patch, priceCents: value },
                })),
            )}
            {numberField("Max riders", createDraft.patch.maxRiders, (value) =>
              setCreateDraft((current) => ({
                ...current,
                patch: { ...current.patch, maxRiders: value },
              })),
            )}
            {numberField("Max judges", createDraft.patch.maxJudges, (value) =>
              setCreateDraft((current) => ({
                ...current,
                patch: { ...current.patch, maxJudges: value },
              })),
            )}
            {numberField(
              "Max organizers",
              createDraft.patch.maxOrganizers,
              (value) =>
                setCreateDraft((current) => ({
                  ...current,
                  patch: { ...current.patch, maxOrganizers: value },
                })),
            )}
            {numberField(
              "Monthly events",
              createDraft.patch.monthlyEventLimit,
              (value) =>
                setCreateDraft((current) => ({
                  ...current,
                  patch: { ...current.patch, monthlyEventLimit: value },
                })),
            )}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={createDraft.patch.isDefault}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    patch: {
                      ...current.patch,
                      isDefault: event.target.checked,
                    },
                  }))
                }
              />
              Default plan
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={createDraft.patch.active}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    patch: { ...current.patch, active: event.target.checked },
                  }))
                }
              />
              Active
            </label>
          </div>
          <button
            type="button"
            disabled={busy || createDraft.slug.length < 2}
            onClick={() =>
              void save(
                createDraft.slug,
                {
                  name: createDraft.patch.name || createDraft.slug,
                  priceCents: Number(createDraft.patch.priceCents) || 0,
                  maxRiders: Number(createDraft.patch.maxRiders) || 0,
                  maxJudges: Number(createDraft.patch.maxJudges) || 0,
                  maxOrganizers: Number(createDraft.patch.maxOrganizers) || 0,
                  monthlyEventLimit:
                    Number(createDraft.patch.monthlyEventLimit) || 1,
                  isDefault: createDraft.patch.isDefault,
                  active: createDraft.patch.active,
                },
                true,
              )
            }
            className="min-h-11 self-start rounded-full bg-primary px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create plan"}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-16  rounded-lg bg-surface-container"
            />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((plan) => (
            <li
              key={plan.slug}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface">
                    {plan.name}
                    <span className="ml-2 font-mono text-[10px] font-normal text-secondary">
                      {plan.slug}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-secondary">
                    {money(plan.priceCents, plan.currency)} · {plan.maxRiders}{" "}
                    riders · {plan.maxJudges} judges · {plan.maxOrganizers}{" "}
                    organizers · {plan.monthlyEventLimit} events/mo
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {plan.isDefault ? (
                    <span className="rounded-md bg-primary px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-primary">
                      Default
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em]",
                      plan.active
                        ? "border-outline-variant text-secondary"
                        : "border-error/40 text-error",
                    )}
                  >
                    {plan.active ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit ${plan.name}`}
                    onClick={() => {
                      setEditingSlug(
                        editingSlug === plan.slug ? null : plan.slug,
                      );
                      setDraft(
                        editingSlug === plan.slug ? null : toEditable(plan),
                      );
                    }}
                    className="inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 text-secondary hover:border-outline hover:text-on-surface"
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {editingSlug === plan.slug && draft ? (
                <div className="mt-3 flex flex-col gap-3 border-t border-outline-variant pt-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
                      Name
                    </span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, name: event.target.value }
                            : current,
                        )
                      }
                      className={MANAGE_CONTROL_CLASSES}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {numberField("Price (cents)", draft.priceCents, (value) =>
                      setDraft((current) =>
                        current ? { ...current, priceCents: value } : current,
                      ),
                    )}
                    {numberField("Max riders", draft.maxRiders, (value) =>
                      setDraft((current) =>
                        current ? { ...current, maxRiders: value } : current,
                      ),
                    )}
                    {numberField("Max judges", draft.maxJudges, (value) =>
                      setDraft((current) =>
                        current ? { ...current, maxJudges: value } : current,
                      ),
                    )}
                    {numberField(
                      "Max organizers",
                      draft.maxOrganizers,
                      (value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, maxOrganizers: value }
                            : current,
                        ),
                    )}
                    {numberField(
                      "Monthly events",
                      draft.monthlyEventLimit,
                      (value) =>
                        setDraft((current) =>
                          current
                            ? { ...current, monthlyEventLimit: value }
                            : current,
                        ),
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-on-surface">
                      <input
                        type="checkbox"
                        checked={draft.isDefault}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? { ...current, isDefault: event.target.checked }
                              : current,
                          )
                        }
                      />
                      Default plan
                    </label>
                    <label className="flex items-center gap-2 text-sm text-on-surface">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? { ...current, active: event.target.checked }
                              : current,
                          )
                        }
                      />
                      Active
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void save(plan.slug, patchFromDraft(), false)
                      }
                      className="min-h-11 rounded-full bg-primary px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSlug(null);
                        setDraft(null);
                      }}
                      className="min-h-11 rounded-full border border-outline-variant px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
