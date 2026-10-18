"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { TvVideo } from "@/types/tv";
import { TvForm } from "./TvForm";
import { parseYouTubeVideoUrl } from "@/lib/tv/urls";
import { formatTvPostDate } from "@/lib/tv/share";

export function TvAdminClient({
  initialVideos,
  disciplines,
}: {
  initialVideos: readonly TvVideo[];
  disciplines: readonly { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<TvVideo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = initialVideos.filter((v) => (filter === "all" ? true : v.disciplineSlug === filter));

  const handleDelete = async (video: TvVideo) => {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    setDeletingId(video.id);
    try {
      const res = await fetch(`/api/admin/tv/${video.id}`, {
        method: "DELETE",
        headers: { "If-Match": `"${video.updatedAt}"` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-6 animate-fade-in">
      <header className="border-b border-outline-variant pb-6">
        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Public rider media — TV channel
        </span>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl">
          TV
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
          Curate YouTube videos classified by discipline. Each entry has discipline, post date and categories (profile, event, music, etc.). Public at <code className="rounded bg-surface-container px-1">/tv</code> — no sign-in required, embeddable via iframe.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter("all")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.99] ${filter === "all" ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-secondary hover:border-outline hover:text-on-surface"}`}
          >
            All ({initialVideos.length})
          </button>
          {disciplines.map((d) => {
            const count = initialVideos.filter((v) => v.disciplineSlug === d.slug).length;
            return (
              <button
                key={d.slug}
                onClick={() => setFilter(d.slug)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.99] ${filter === d.slug ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-secondary hover:border-outline hover:text-on-surface"}`}
              >
                {d.name} ({count})
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowCreate((v) => !v);
          }}
          className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
        >
          <Plus size={13} aria-hidden="true" />
          {showCreate ? "Close" : "Add video"}
        </button>
      </div>

      {showCreate ? (
        <TvForm
          disciplines={disciplines}
          onDone={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      ) : null}

      {editing ? (
        <TvForm
          key={editing.id}
          initial={editing}
          disciplines={disciplines}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-low font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            <tr>
              <th className="px-3 py-2">Discipline</th>
              <th className="px-3 py-2">Categories</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Post date</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-secondary">
                  No videos for this filter. Add a YouTube link above.
                </td>
              </tr>
            ) : (
              filtered.map((v) => {
                const d = formatTvPostDate(v.postDate) || v.postDate.slice(0, 10);
                const thumb = (() => {
                  const p = parseYouTubeVideoUrl(v.youtubeUrl);
                  if (!p) return null;
                  try {
                    const u = new URL(p.canonicalUrl);
                    const id = u.searchParams.get("v");
                    return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
                  } catch {
                    return null;
                  }
                })();
                return (
                  <tr key={v.id} className="transition-colors hover:bg-surface-container-low">
                    <td className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-on-surface">{v.disciplineSlug}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {v.categories.map((cat) => (
                          <span
                            key={cat}
                            className="rounded-md bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-on-surface-variant"
                          >
                            {cat}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            width={320}
                            height={180}
                            referrerPolicy="no-referrer"
                            className="h-8 w-14 rounded-md object-cover"
                          />
                        ) : null}
                        <span className="line-clamp-1 max-w-[28ch] font-medium">{v.title}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-secondary">{d}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-eyebrow ${v.published ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-secondary"}`}>
                        {v.published ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(v)}
                          aria-label={`Edit ${v.title}`}
                          title={`Edit ${v.title}`}
                          className="rounded-full border border-outline-variant p-1.5 hover:bg-surface-container"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          disabled={deletingId === v.id}
                          aria-label={`Delete ${v.title}`}
                          title={`Delete ${v.title}`}
                          className="rounded-full border border-outline-variant p-1.5 text-error hover:bg-error-container disabled:opacity-50"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
