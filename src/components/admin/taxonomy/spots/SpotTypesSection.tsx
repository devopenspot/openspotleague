"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/admin/common/DeleteConfirmDialog";
import type { TaxonomyEntry } from "@/lib/repositories/taxonomy/taxonomy-repository";
import { showToast } from "@/hooks/ui/useToast";
import { usePendingActions } from "@/hooks/data/usePendingActions";
import { adminRequest, getAdminErrorMessage } from "@/lib/admin/request";

type PendingDelete = {
  kind: "spot-type";
  slug: string;
  label: string;
  description: string;
};

export function SpotTypesSection({ spotTypes }: { spotTypes: readonly TaxonomyEntry[] }) {
  const [typeRows, setTypeRows] = useState(() => [...spotTypes]);
  const [newType, setNewType] = useState(() => ({
    slug: "",
    name: "",
    sortOrder: String(spotTypes.length),
  }));
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const { pending, run: runAction } = usePendingActions();

  async function addSpotType() {
    await runAction("spot-type:new", async () => {
      try {
        const created = (await adminRequest("/api/admin/spot-types", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: newType.slug,
            name: newType.name,
            sortOrder: Number(newType.sortOrder),
          }),
        })) as TaxonomyEntry;
        setTypeRows((rows) => [...rows, created]);
        setNewType({
          slug: "",
          name: "",
          sortOrder: String(typeRows.length + 1),
        });
        showToast("Spot type added", "success");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Spot type could not be added"), "error");
      }
    });
  }

  async function saveSpotType(row: TaxonomyEntry) {
    await runAction(`spot-type:${row.slug}`, async () => {
      try {
        await adminRequest(`/api/admin/spot-types/${row.slug}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: row.name, sortOrder: row.sortOrder }),
        });
        showToast("Spot type saved", "success");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Spot type could not be saved"), "error");
      }
    });
  }

  function removeSpotType(slug: string) {
    const row = typeRows.find((item) => item.slug === slug);
    if (!row) return;
    setPendingDelete({
      kind: "spot-type",
      slug,
      label: row.name,
      description: `Delete "${row.name}"? It must not be in use. This cannot be undone.`,
    });
  }

  async function deleteSpotType(slug: string) {
    await runAction(`spot-type:${slug}`, async () => {
      try {
        await adminRequest(`/api/admin/spot-types/${slug}`, { method: "DELETE" });
        setTypeRows((rows) => rows.filter((row) => row.slug !== slug));
        showToast("Spot type deleted", "success");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Spot type could not be deleted"), "error");
      }
    });
  }

  async function confirmDelete() {
    const current = pendingDelete;
    if (!current) return;
    await deleteSpotType(current.slug);
    setPendingDelete(null);
  }

  return (
    <>
      <div className="space-y-6">
        <div
          aria-busy={pending.has("spot-type:new")}
          className="grid gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-[1fr_1fr_5rem_auto]"
        >
          <input
            value={newType.slug}
            placeholder="slug"
            aria-label="New spot type slug"
            onChange={(event) => setNewType({ ...newType, slug: event.target.value })}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base sm:text-sm"
          />
          <input
            value={newType.name}
            placeholder="Name"
            aria-label="New spot type name"
            onChange={(event) => setNewType({ ...newType, name: event.target.value })}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base sm:text-sm"
          />
          <input
            type="number"
            value={newType.sortOrder}
            aria-label="New spot type sort order"
            onChange={(event) => setNewType({ ...newType, sortOrder: event.target.value })}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base sm:text-sm"
          />
          <button
            type="button"
            disabled={pending.has("spot-type:new")}
            onClick={() => void addSpotType()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {typeRows.map((row, index) => (
          <div
            key={row.slug}
            aria-busy={pending.has(`spot-type:${row.slug}`)}
            className="grid gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 sm:grid-cols-[8rem_1fr_5rem_auto_auto]"
          >
            <code className="p-2 text-xs text-on-surface-variant">{row.slug}</code>
            <input
              value={row.name}
              aria-label={`${row.slug} name`}
              onChange={(event) =>
                setTypeRows((rows) =>
                  rows.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                )
              }
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base sm:text-sm"
            />
            <input
              type="number"
              value={row.sortOrder}
              aria-label={`${row.slug} sort order`}
              onChange={(event) =>
                setTypeRows((rows) =>
                  rows.map((item, i) => (i === index ? { ...item, sortOrder: Number(event.target.value) } : item)),
                )
              }
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base sm:text-sm"
            />
            <button
              type="button"
              disabled={pending.has(`spot-type:${row.slug}`)}
              onClick={() => void saveSpotType(row)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              aria-label={`Delete ${row.name}`}
              disabled={pending.has(`spot-type:${row.slug}`)}
              onClick={() => void removeSpotType(row.slug)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-error bg-surface-container-lowest px-4 py-2 text-error transition-colors hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <DeleteConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete spot type"
        description={pendingDelete?.description ?? ""}
        confirmLabel="Confirm"
      />
    </>
  );
}
