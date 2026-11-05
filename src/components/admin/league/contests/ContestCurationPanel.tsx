"use client";

/**
 * Curator actions for one contest: moderate details and links, feature it,
 * hide it from (or list it on) the public listing, replace the cover, and
 * cancel it. Every action sends the loaded `version` (OCC) and a fresh
 * idempotency key; the server page re-reads after each success.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye, Ban, Save } from "lucide-react";
import { ContestCoverField } from "@/components/league/cover/ContestCoverField";
import {
  FormSection,
  TextField,
  TextareaField,
} from "@/components/league/form-parts";
import { alertClass, controlClass } from "@/components/ui/recipes";
import type { LeagueEventState } from "@/lib/services/league";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";

type ContestEvent = LeagueEventState["event"];

export function ContestCurationPanel({
  event,
  canListPublicly,
}: {
  event: ContestEvent;
  canListPublicly: boolean;
}) {
  const router = useRouter();
  const base = `/api/admin/league/contests/${event.id}`;
  const terminal = event.status === "completed" || event.status === "cancelled";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: event.name,
    shortName: event.shortName ?? "",
    description: event.description,
    url: event.url ?? "",
    instagram: event.instagram ?? "",
    youtube: event.youtube ?? "",
    featured: event.featured,
  });

  async function send(
    request: () => Promise<Response>,
    done: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request();
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setError(raw?.message ?? raw?.error ?? "Action failed.");
        return false;
      }
      setNotice(done);
      setReason("");
      router.refresh();
      return true;
    } catch {
      setError("Action failed. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function json(path: string, method: "POST" | "PATCH" | "DELETE", body: object) {
    return () =>
      fetchWithTimeout(`${base}${path}`, {
        method,
        timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: event.version,
          idempotencyKey: crypto.randomUUID(),
          reason: reason.trim() || undefined,
          ...body,
        }),
      });
  }

  function uploadCover(file: File) {
    return () => {
      const data = new FormData();
      data.append("image", file);
      data.append("expectedVersion", String(event.version));
      data.append("idempotencyKey", crypto.randomUUID());
      return fetchWithTimeout(`${base}/cover`, {
        method: "POST",
        body: data,
        timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS * 4,
      });
    };
  }

  const isPublic = event.visibility === "public";

  return (
    <div className="space-y-5">
      {error ? (
        <div role="alert" className={`text-sm ${alertClass("error")}`}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className={`text-sm ${alertClass("neutral")}`}>
          {notice}
        </div>
      ) : null}

      <FormSection
        icon={Save}
        title="Details & links"
        intro={
          terminal
            ? "Finished contests are read-only."
            : "Fix copy and links at any time before the contest ends."
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="cur-name"
            label="Name"
            value={form.name}
            disabled={busy || terminal}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <TextField
            id="cur-short-name"
            label="Short name"
            value={form.shortName}
            disabled={busy || terminal}
            onChange={(value) => setForm({ ...form, shortName: value })}
          />
          <TextareaField
            id="cur-description"
            label="Description"
            value={form.description}
            onChange={(value) => setForm({ ...form, description: value })}
            className="sm:col-span-2"
          />
          <TextField
            id="cur-url"
            type="url"
            label="Official site"
            value={form.url}
            disabled={busy || terminal}
            onChange={(value) => setForm({ ...form, url: value })}
            className="sm:col-span-2"
          />
          <TextField
            id="cur-instagram"
            type="url"
            label="Instagram"
            value={form.instagram}
            disabled={busy || terminal}
            onChange={(value) => setForm({ ...form, instagram: value })}
          />
          <TextField
            id="cur-youtube"
            type="url"
            label="YouTube"
            value={form.youtube}
            disabled={busy || terminal}
            onChange={(value) => setForm({ ...form, youtube: value })}
          />
          <label className="inline-flex items-center gap-2 text-sm text-on-surface sm:col-span-2">
            <input
              type="checkbox"
              checked={form.featured}
              disabled={busy || terminal || !isPublic}
              onChange={(event) =>
                setForm({ ...form, featured: event.target.checked })
              }
            />
            Feature on the League page
            {!isPublic ? (
              <span className="text-secondary">(public contests only)</span>
            ) : null}
          </label>
        </div>
      </FormSection>

      <TextField
        id="cur-reason"
        label="Moderation note (optional, kept in the action log)"
        value={reason}
        disabled={busy}
        onChange={setReason}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || terminal}
          className={controlClass("primary")}
          onClick={() =>
            void send(
              json("", "PATCH", {
                patch: {
                  name: form.name.trim() || undefined,
                  shortName: form.shortName.trim() || undefined,
                  description: form.description,
                  url: form.url.trim() || null,
                  instagram: form.instagram.trim() || null,
                  youtube: form.youtube.trim() || null,
                  featured: isPublic ? form.featured : undefined,
                },
              }),
              "Contest updated.",
            )
          }
        >
          <Save size={14} aria-hidden="true" />
          Save details
        </button>
        {isPublic ? (
          <button
            type="button"
            disabled={busy || terminal}
            className={controlClass("outline")}
            onClick={() =>
              void send(
                json("/visibility", "POST", { visibility: "unlisted" }),
                "Contest hidden from the public listing.",
              )
            }
          >
            <EyeOff size={14} aria-hidden="true" />
            Hide from public
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || terminal || !canListPublicly}
            title={
              canListPublicly
                ? undefined
                : "Public listing needs an active paid or comped plan"
            }
            className={controlClass("outline")}
            onClick={() =>
              void send(
                json("/visibility", "POST", { visibility: "public" }),
                "Contest listed publicly.",
              )
            }
          >
            <Eye size={14} aria-hidden="true" />
            List publicly
          </button>
        )}
        <button
          type="button"
          disabled={busy || terminal}
          className={controlClass("outline")}
          onClick={() => {
            if (!window.confirm("Cancel this contest? Members are notified. This cannot be undone.")) {
              return;
            }
            void send(json("/cancel", "POST", {}), "Contest cancelled.");
          }}
        >
          <Ban size={14} aria-hidden="true" />
          Cancel contest
        </button>
      </div>

      <FormSection icon={Eye} title="Cover" intro="Shown on the contest page and listing.">
        <ContestCoverField
          id="cur-cover"
          file={coverFile}
          onFileChange={setCoverFile}
          currentImage={event.imageUrl}
          onRemoveCurrent={
            terminal
              ? undefined
              : () =>
                  void send(json("/cover", "DELETE", {}), "Cover removed.")
          }
          categoryName={event.categoryName}
          sports={[]}
          disabled={busy || terminal}
        />
        {coverFile ? (
          <button
            type="button"
            disabled={busy || terminal}
            className={`mt-3 ${controlClass("primary", "sm")}`}
            onClick={() =>
              void send(uploadCover(coverFile), "Cover updated.").then((ok) => {
                if (ok) setCoverFile(null);
              })
            }
          >
            Save cover
          </button>
        ) : null}
      </FormSection>
    </div>
  );
}
