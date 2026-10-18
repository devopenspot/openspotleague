"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/admin/common/DeleteConfirmDialog";
import type { TaxonomyEntry } from "@/lib/repositories/taxonomy/taxonomy-repository";
import { showToast } from "@/hooks/ui/useToast";
import { usePendingActions } from "@/hooks/data/usePendingActions";
import { adminRequest, getAdminErrorMessage } from "@/lib/admin/request";

type PendingDelete = {
  kind: "sport";
  slug: string;
  label: string;
  description: string;
};

export function SportsSection({ sports }: { sports: readonly TaxonomyEntry[] }) {
  const [sportRows, setSportRows] = useState(() => [...sports]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const { pending, run: runAction } = usePendingActions();

  async function saveSport(row: TaxonomyEntry) {
    await runAction(`sport:${row.slug}`, async () => {
      try {
        await adminRequest(`/api/admin/sports/${row.slug}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: row.name, sortOrder: row.sortOrder }),
        });
        showToast("Sport saved", "success");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Sport could not be saved"), "error");
      }
    });
  }

  function removeSport(slug: string) {
    const row = sportRows.find((item) => item.slug === slug);
    if (!row) return;
    setPendingDelete({
      kind: "sport",
      slug,
      label: row.name,
      description: `Delete "${row.name}"? It must not be referenced by spots, events, or games. This cannot be undone.`,
    });
  }

  async function deleteSport(slug: string) {
    await runAction(`sport:${slug}`, async () => {
      try {
        await adminRequest(`/api/admin/sports/${slug}`, { method: "DELETE" });
        setSportRows((rows) => rows.filter((row) => row.slug !== slug));
        showToast("Sport deleted", "success");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Sport could not be deleted"), "error");
      }
    });
  }

  async function confirmDelete() {
    const current = pendingDelete;
    if (!current) return;
    await deleteSport(current.slug);
    setPendingDelete(null);
  }

  return (
    <>
      <div className="space-y-3">
        {sportRows.map((row, index) => (
          <div
            key={row.slug}
            aria-busy={pending.has(`sport:${row.slug}`)}
            className="grid gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 sm:grid-cols-[1fr_5rem_auto_auto]"
          >
            <input
              value={row.name}
              aria-label={`${row.slug} name`}
              onChange={(event) =>
                setSportRows((rows) =>
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
                setSportRows((rows) =>
                  rows.map((item, i) =>
                    i === index ? { ...item, sortOrder: Number(event.target.value) } : item,
                  ),
                )
              }
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-base sm:text-sm"
            />
            <button
              type="button"
              disabled={pending.has(`sport:${row.slug}`)}
              onClick={() => void saveSport(row)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              aria-label={`Delete ${row.name}`}
              disabled={pending.has(`sport:${row.slug}`)}
              onClick={() => void removeSport(row.slug)}
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
        title="Delete sport"
        description={pendingDelete?.description ?? ""}
        confirmLabel="Confirm"
      />
    </>
  );
}
