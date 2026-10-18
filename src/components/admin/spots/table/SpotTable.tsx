"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Instagram,
  ShieldCheck,
  EyeOff,
  Eye,
  Layers,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/admin/common/DeleteConfirmDialog";
import { TypeBadges } from "@/components/spots/shared/TypeBadges";
import { showToast } from "@/hooks/ui/useToast";
import { formatUtcDate } from "@/lib/utils/format-date";
import type { Spot } from "@/lib/types";

interface SpotTableProps {
  spots: readonly Spot[];
  nextCursor: string | null;
}

function socialLabel(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function verificationLabel(count: number): string {
  if (count === 0) return "—";
  if (count === 1) return "1";
  return count.toString();
}

type PendingAction = { spot: Spot; mode: "single" | "cluster" | "delete" | "unhide" } | null

export function SpotTable({ spots, nextCursor }: SpotTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<PendingAction>(null);

  const nextPageParams = new URLSearchParams(searchParams.toString());
  if (nextCursor) nextPageParams.set("cursor", nextCursor);
  const nextPageHref = `${pathname}?${nextPageParams.toString()}`;

  const handleDeleted = async () => {
    if (!pendingDelete) return;
    const { spot, mode } = pendingDelete
    if (mode === "unhide") {
      const res = await fetch(`/api/admin/spots/${encodeURIComponent(spot.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "If-Match": `"${spot.updatedAt}"` },
        body: JSON.stringify({ action: "unhide" }),
      })
      if (res.status === 401) { router.push("/login"); return }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        showToast(body?.error ?? `Unhide failed (${res.status})`, "error")
        return
      }
      showToast(`Unhidden ${spot.name}`, "success")
      setPendingDelete(null)
      router.refresh()
      return
    }
    if (mode === "cluster") {
      const res = await fetch(`/api/admin/spots/${encodeURIComponent(spot.id)}?mode=cluster`, {
        method: "DELETE",
        headers: { "If-Match": `"${spot.updatedAt}"` },
      })
      if (res.status === 401) { router.push("/login"); return }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; hiddenCount?: number } | null
        showToast(body?.error ?? `Hide cluster failed (${res.status})`, "error")
        return
      }
      const body = (await res.json().catch(() => null)) as { hiddenCount?: number } | null
      showToast(`Hidden ${body?.hiddenCount ?? "cluster"} spots around ${spot.name}`, "success")
      setPendingDelete(null)
      router.refresh()
      return
    }
    const res = await fetch(
      `/api/admin/spots/${encodeURIComponent(spot.id)}`,
      {
        method: "DELETE",
        headers: { "If-Match": `"${spot.updatedAt}"` },
      },
    );
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok && res.status !== 204) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        hidden?: boolean;
      } | null;
      if (body?.hidden) {
        showToast(`Hidden ${spot.name} from public (still private for owner)`, "success")
        setPendingDelete(null)
        router.refresh()
        return
      }
      showToast(body?.error ?? `Delete failed (${res.status})`, "error");
      return;
    }
    // 204 hard delete or hidden json
    if (res.status === 204) {
      showToast(`Deleted ${spot.name}`, "success");
    } else {
      const body = (await res.json().catch(() => null)) as { hidden?: boolean } | null
      if (body?.hidden) showToast(`Hidden ${spot.name} from public (still private for owner)`, "success")
      else showToast(`Deleted ${spot.name}`, "success")
    }
    setPendingDelete(null);
    router.refresh();
  };

  if (spots.length === 0) {
    return (
      <div
        role="status"
        className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-10 text-center"
      >
        <p className="font-display text-lg font-bold tracking-tight text-on-surface">No spots match these filters</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Clear a filter or create the first spot in this catalogue.</p>
        <Link
          href="/admin/spots/new"
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
        >
          Create spot
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest md:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-outline-variant bg-surface-container-low font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3">
                Name
              </th>
              <th scope="col" className="px-4 py-3">
                City
              </th>
              <th scope="col" className="px-4 py-3">
                Sport
              </th>
              <th scope="col" className="px-4 py-3">
                Type
              </th>
              <th scope="col" className="px-4 py-3">
                Country
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
              <th scope="col" className="px-4 py-3">
                Socials
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {spots.map((spot) => (
              <tr
                key={spot.id}
                className="transition-colors hover:bg-surface-container-low"
              >
                <td className="px-4 py-3 font-bold text-on-surface">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/admin/spots/${spot.id}`}
                      className="hover:underline focus:outline-none focus-visible:underline"
                    >
                      {spot.name}
                    </a>
                    {(spot as unknown as { adminHidden?: boolean }).adminHidden ? (
                      <span className="rounded-md border border-outline-variant bg-surface-container-high px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-eyebrow text-secondary">Hidden</span>
                    ) : null}
                    {(spot as unknown as { origin?: string }).origin === "community" ? (
                      <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-eyebrow text-on-primary">Community</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-secondary">{spot.city}</td>
                <td className="px-4 py-3 text-secondary">
                  {spot.sports.length > 0 ? spot.sports.join(", ") : "—"}
                </td>
                <td className="px-4 py-3">
                  {spot.types.length > 0 ? (
                    <TypeBadges types={spot.types} variant="ghost" />
                  ) : null}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {spot.country || "—"}
                </td>
                <td className="px-4 py-3 text-secondary">
                  <time dateTime={spot.updatedAt}>
                    {formatUtcDate(spot.updatedAt)}
                  </time>
                </td>
                <td className="px-4 py-3">
                  <ul
                    aria-label={`${spot.name} social profiles`}
                    className="flex flex-col gap-1"
                  >
                    <li
                      className="flex items-center gap-1.5 font-display text-[10px] text-secondary"
                      title={spot.instagram ?? "Not set"}
                    >
                      <Instagram
                        size={11}
                        aria-hidden="true"
                        className={
                          spot.instagram ? "text-on-surface" : "text-outline"
                        }
                      />
                      <span className="truncate max-w-[140px]">
                        {socialLabel(spot.instagram)}
                      </span>
                    </li>
                    <li
                      className="flex items-center gap-1.5 font-display text-[10px] text-secondary"
                      title={`${spot.verificationCount} verifications`}
                    >
                      <ShieldCheck
                        size={11}
                        aria-hidden="true"
                        className={
                          spot.verificationCount > 0
                            ? "text-on-surface"
                            : "text-outline"
                        }
                      />
                      <span>{verificationLabel(spot.verificationCount)}</span>
                    </li>
                  </ul>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <a
                      href={`/admin/spots/${spot.id}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:text-on-surface active:scale-[0.99]"
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Edit
                    </a>
                    {(spot as unknown as { adminHidden?: boolean }).adminHidden ? (
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ spot, mode: "unhide" })}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:text-primary active:scale-[0.99]"
                      >
                        <Eye size={13} aria-hidden="true" /> Unhide
                      </button>
                    ) : (spot as unknown as { origin?: string }).origin === "seed" ? (
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ spot, mode: "delete" })}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:text-error active:scale-[0.99]"
                      >
                        <Trash2 size={13} aria-hidden="true" /> Delete
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ spot, mode: "single" })}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:text-error active:scale-[0.99]"
                        >
                          <EyeOff size={13} aria-hidden="true" /> Hide
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ spot, mode: "cluster" })}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:text-error active:scale-[0.99]"
                        >
                          <Layers size={13} aria-hidden="true" /> Cluster
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden" aria-label="Spots list">
        {spots.map((spot) => (
          <article
            key={spot.id}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a
                  href={`/admin/spots/${spot.id}`}
                  className="font-display text-lg font-bold text-on-surface hover:underline focus:outline-none focus-visible:underline"
                >
                  {spot.name}
                </a>
                <p className="mt-1 text-sm text-secondary">
                  {spot.city}, {spot.country || "Country not set"}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-surface-container-high px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                {spot.sports[0] ?? "No sport"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-3 text-xs">
              <div>
                <dt className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                  Types
                </dt>
                <dd className="mt-1 text-on-surface">
                  {spot.types.map((type) => type.name).join(", ") || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                  Updated
                </dt>
                <dd className="mt-1 text-on-surface">
                  <time dateTime={spot.updatedAt}>
                    {formatUtcDate(spot.updatedAt)}
                  </time>
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={`/admin/spots/${spot.id}`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
              >
                <Pencil size={13} aria-hidden="true" />
                <span>Edit</span>
              </a>
              {(spot as unknown as { adminHidden?: boolean }).adminHidden ? (
                <button
                  type="button"
                  onClick={() => setPendingDelete({ spot, mode: "unhide" })}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-low active:scale-[0.99]"
                >
                  <Eye size={13} aria-hidden="true" />
                  <span>Unhide</span>
                </button>
              ) : (spot as unknown as { origin?: string }).origin === "seed" ? (
                <button
                  type="button"
                  onClick={() => setPendingDelete({ spot, mode: "delete" })}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-error px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99]"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ spot, mode: "single" })}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99]"
                  >
                    <EyeOff size={13} aria-hidden="true" />
                    <span>Hide</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ spot, mode: "cluster" })}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99]"
                  >
                    <Layers size={13} aria-hidden="true" />
                    <span>Cluster</span>
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {nextCursor ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-sm text-secondary">
            More spots are available with these filters.
          </p>
          <Link
            href={nextPageHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
          >
            Next page
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <DeleteConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleted}
        title={
          pendingDelete?.mode === "unhide" ? "Unhide spot"
            : pendingDelete?.mode === "cluster" ? "Hide cluster"
            : pendingDelete?.mode === "single" ? "Hide from public"
            : "Delete spot"
        }
        description={
          pendingDelete
            ? pendingDelete.mode === "unhide"
              ? `Unhide "${pendingDelete.spot.name}"? It will reappear in public directory and counts.`
              : pendingDelete.mode === "cluster"
                ? `Hide "${pendingDelete.spot.name}" and all spots within 300 m? They will stay private for their owners and stop counting.`
                : pendingDelete.mode === "single"
                  ? `Hide "${pendingDelete.spot.name}" from public view? It will stay private for its owner and be excluded from counts. Use Hide cluster for spam groups or to fix a misplaced single spot.`
                  : `Delete "${pendingDelete.spot.name}"? Saves and verifications for this spot are removed; games are kept but detached (open lobbies removed, running games cancelled) and stay readable as a removed spot. This cannot be undone.`
            : ""
        }
      />
    </>
  );
}
