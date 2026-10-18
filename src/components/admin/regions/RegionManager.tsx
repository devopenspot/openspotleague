"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Globe, Trash2, Plus, MapPin, Search, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { DeleteConfirmDialog } from "@/components/admin/common/DeleteConfirmDialog"
import { showToast } from "@/hooks/ui/useToast"
import { usePendingActions } from "@/hooks/data/usePendingActions"
import { adminRequest, getAdminErrorMessage } from "@/lib/admin/request"
import type { AdminRegion, AdminCountry } from "@/lib/repositories/admin/admin-region-repository"

type Section = "regions" | "countries"

type PendingDelete =
  | {
      kind: "region"
      id: string
      label: string
      description: string
    }
  | {
      kind: "country"
      iso2: string
      label: string
      description: string
    }

export function RegionManager({
  initialRegions,
  initialCountries,
}: {
  initialRegions: readonly AdminRegion[]
  initialCountries: readonly AdminCountry[]
}) {
  const router = useRouter()
  const [section, setSection] = useState<Section>("regions")
  const [regionRows, setRegionRows] = useState<AdminRegion[]>([...initialRegions])
  const [countryRows, setCountryRows] = useState<AdminCountry[]>([...initialCountries])
  const [newRegion, setNewRegion] = useState({
    slug: "",
    name: "",
    description: "",
    imageUrl: "",
    sortOrder: String(Math.max(0, ...initialRegions.map((r) => r.sortOrder)) + 1),
  })
  const [newCountry, setNewCountry] = useState({
    iso2: "",
    name: "",
    iso3: "",
    regionId: initialRegions[0]?.id ?? "",
  })
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const { pending: pendingActions, run: runAction } = usePendingActions()
  const [searchQuery, setSearchQuery] = useState("")
  const [countryRegionFilter, setCountryRegionFilter] = useState<string>("")

  const filteredCountries = useMemo(
    () =>
      countryRows.filter((country) => {
        if (countryRegionFilter && country.regionId !== countryRegionFilter) return false
        const q = searchQuery.trim().toLowerCase()
        if (!q) return true
        return (
          country.name.toLowerCase().includes(q) ||
          country.regionName.toLowerCase().includes(q) ||
          country.iso2.toLowerCase().includes(q) ||
          (country.iso3 ?? "").toLowerCase().includes(q)
        )
      }),
    [countryRows, countryRegionFilter, searchQuery],
  )

  async function saveRegion(row: AdminRegion) {
    await runAction(`region:${row.id}`, async () => {
      const previous = row
      try {
        await adminRequest(`/api/admin/regions/${row.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            slug: row.slug,
            description: row.description,
            imageUrl: row.imageUrl,
            sortOrder: row.sortOrder,
          }),
        })
        showToast("Region saved", "success")
        router.refresh()
      } catch (error) {
        setRegionRows((rows) =>
          rows.map((item) => (item.id === previous.id ? previous : item)),
        )
        showToast(getAdminErrorMessage(error, "Region could not be saved"), "error")
      }
    })
  }

  function removeRegion(id: string) {
    const row = regionRows.find((item) => item.id === id)
    if (!row) return
    if (row.countryCount > 0) {
      showToast(
        `Cannot delete "${row.name}" — it has ${row.countryCount} associated countries. Move or delete them first.`,
        "error",
      )
      return
    }
    setPendingDelete({
      kind: "region",
      id,
      label: row.name,
      description: `Delete "${row.name}"? This cannot be undone.`,
    })
  }

  async function deleteRegion(id: string) {
    await adminRequest(`/api/admin/regions/${id}`, { method: "DELETE" })
    setRegionRows((rows) => rows.filter((row) => row.id !== id))
    router.refresh()
  }

  async function addRegion() {
    await runAction("region:new", async () => {
      try {
        const created = (await adminRequest("/api/admin/regions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: newRegion.slug,
            name: newRegion.name,
            description: newRegion.description,
            imageUrl: newRegion.imageUrl || null,
            sortOrder: Number(newRegion.sortOrder) || 0,
          }),
        })) as AdminRegion
        setRegionRows((rows) => [...rows, created])
        if (!newCountry.regionId && created.id) {
          setNewCountry((prev) => ({ ...prev, regionId: created.id }))
        }
        setNewRegion({
          slug: "",
          name: "",
          description: "",
          imageUrl: "",
          sortOrder: String(created.sortOrder + 1),
        })
        showToast("Region added", "success")
        router.refresh()
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Region could not be added"), "error")
      }
    })
  }

  async function addCountry() {
    await runAction("country:new", async () => {
      try {
        const created = (await adminRequest("/api/admin/countries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            iso2: newCountry.iso2.trim().toUpperCase(),
            name: newCountry.name.trim(),
            iso3: newCountry.iso3.trim() === "" ? null : newCountry.iso3.trim().toUpperCase(),
            regionId: newCountry.regionId,
          }),
        })) as AdminCountry
        setCountryRows((rows) => {
          const next = [...rows, created]
          next.sort((a, b) => {
            const ra = regionRows.find((r) => r.id === a.regionId)?.sortOrder ?? 0
            const rb = regionRows.find((r) => r.id === b.regionId)?.sortOrder ?? 0
            if (ra !== rb) return ra - rb
            return a.name.localeCompare(b.name)
          })
          return next
        })
        setRegionRows((rows) =>
          rows.map((r) => (r.id === created.regionId ? { ...r, countryCount: r.countryCount + 1 } : r)),
        )
        setNewCountry({ iso2: "", name: "", iso3: "", regionId: created.regionId })
        showToast("Country added", "success")
        router.refresh()
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Country could not be added"), "error")
      }
    })
  }

  async function saveCountry(country: AdminCountry) {
    await runAction(`country:${country.iso2}`, async () => {
      const previous = country
      try {
        const iso3 = country.iso3?.trim() === "" ? null : country.iso3
        await adminRequest(`/api/admin/countries/${country.iso2}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: country.name,
            iso3,
            regionId: country.regionId,
          }),
        })
        showToast("Country saved", "success")
        router.refresh()
      } catch (error) {
        setCountryRows((rows) =>
          rows.map((item) => (item.iso2 === previous.iso2 ? previous : item)),
        )
        showToast(getAdminErrorMessage(error, "Country could not be saved"), "error")
      }
    })
  }

  function updateCountryRegion(iso2: string, regionId: string) {
    const region = regionRows.find((r) => r.id === regionId)
    setCountryRows((rows) =>
      rows.map((row) =>
        row.iso2 === iso2
          ? { ...row, regionId, regionName: region?.name ?? "" }
          : row,
      ),
    )
  }

  function removeCountry(iso2: string) {
    const row = countryRows.find((item) => item.iso2 === iso2)
    if (!row) return
    if (row.spotCount > 0 || row.eventCount > 0) {
      const parts: string[] = []
      if (row.spotCount > 0) parts.push(`${row.spotCount} spot${row.spotCount === 1 ? "" : "s"}`)
      if (row.eventCount > 0) parts.push(`${row.eventCount} event${row.eventCount === 1 ? "" : "s"}`)
      showToast(
        `Cannot delete "${row.name}" — it has ${parts.join(" and ")}. Delete or reassign them first.`,
        "error",
      )
      return
    }
    setPendingDelete({
      kind: "country",
      iso2,
      label: row.name,
      description: `Delete "${row.name}"? This cannot be undone.`,
    })
  }

  async function deleteCountry(iso2: string) {
    const deleted = countryRows.find((r) => r.iso2 === iso2)
    await adminRequest(`/api/admin/countries/${iso2}`, { method: "DELETE" })
    setCountryRows((rows) => rows.filter((row) => row.iso2 !== iso2))
    if (deleted) {
      setRegionRows((rows) =>
        rows.map((r) => (r.id === deleted.regionId ? { ...r, countryCount: Math.max(0, r.countryCount - 1) } : r)),
      )
    }
    router.refresh()
  }

  async function confirmDelete() {
    const current = pendingDelete
    if (!current) return
    if (current.kind === "region") {
      await deleteRegion(current.id)
    } else if (current.kind === "country") {
      await deleteCountry(current.iso2)
    }
    setPendingDelete(null)
  }

  const regionOptions = useMemo(
    () => regionRows.map((r) => ({ value: r.id, label: r.name })),
    [regionRows],
  )

  return (
    <section className="space-y-6">
      <div className="flex gap-2 border-b border-outline-variant">
        <button
          type="button"
          onClick={() => setSection("regions")}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 px-3 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] border-b-2 transition-colors duration-150 ease-out",
            section === "regions"
              ? "border-primary text-on-surface"
              : "border-transparent text-secondary hover:text-on-surface",
          )}
        >
          Regions
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-secondary">
            {regionRows.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSection("countries")}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 px-3 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] border-b-2 transition-colors duration-150 ease-out",
            section === "countries"
              ? "border-primary text-on-surface"
              : "border-transparent text-secondary hover:text-on-surface",
          )}
        >
          Countries
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-secondary">
            {countryRows.length}
          </span>
        </button>
      </div>

      {section === "regions" && (
        <div className="space-y-4">
          <div
            aria-busy={pendingActions.has("region:new")}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <span className="mb-3 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              New region
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={newRegion.slug}
                placeholder="slug (lowercase, hyphens)"
                aria-label="New region slug"
                onChange={(e) => setNewRegion({ ...newRegion, slug: e.target.value })}
                className="w-full"
              />
              <input
                value={newRegion.name}
                placeholder="Name"
                aria-label="New region name"
                onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })}
                className="w-full"
              />
              <input
                value={newRegion.description}
                placeholder="Description"
                aria-label="New region description"
                onChange={(e) => setNewRegion({ ...newRegion, description: e.target.value })}
                className="w-full sm:col-span-2"
              />
              <input
                value={newRegion.imageUrl}
                placeholder="Image URL (optional)"
                aria-label="New region image URL"
                onChange={(e) => setNewRegion({ ...newRegion, imageUrl: e.target.value })}
                className="w-full"
              />
              <div className="flex items-end gap-3">
                <input
                  type="number"
                  value={newRegion.sortOrder}
                  aria-label="New region sort order"
                  onChange={(e) => setNewRegion({ ...newRegion, sortOrder: e.target.value })}
                  className="w-24"
                />
                <button
                  type="button"
                  disabled={pendingActions.has("region:new") || !newRegion.slug || !newRegion.name}
                  onClick={() => void addRegion()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {regionRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-10 text-center">
              <p className="text-sm text-on-surface-variant">
                No regions yet. Create your first region using the form above.
              </p>
            </div>
          )}

          {regionRows.map((row) => (
            <div
              key={row.id}
              aria-busy={pendingActions.has(`region:${row.id}`)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem_5rem_auto_auto] sm:items-center">
                <input
                  value={row.name}
                  aria-label={`${row.name} name`}
                  onChange={(e) =>
                    setRegionRows((rows) =>
                      rows.map((item) =>
                        item.id === row.id ? { ...item, name: e.target.value } : item,
                      ),
                    )
                  }
                  className="w-full"
                />
                <code className="hidden p-2 text-sm text-on-surface-variant sm:block">{row.slug}</code>
                <input
                  type="number"
                  value={row.sortOrder}
                  aria-label={`${row.name} sort order`}
                  onChange={(e) =>
                    setRegionRows((rows) =>
                      rows.map((item) =>
                        item.id === row.id ? { ...item, sortOrder: Number(e.target.value) } : item,
                      ),
                    )
                  }
                  className="w-20"
                />
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <Globe size={14} aria-hidden="true" />
                  {row.countryCount} countries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingActions.has(`region:${row.id}`)}
                    onClick={() => void saveRegion(row)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${row.name}`}
                    title={row.countryCount > 0 ? "Move or delete associated countries first" : undefined}
                    disabled={pendingActions.has(`region:${row.id}`)}
                    onClick={() => void removeRegion(row.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-error bg-surface-container-lowest px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  value={row.description}
                  aria-label={`${row.name} description`}
                  placeholder="Description"
                  onChange={(e) =>
                    setRegionRows((rows) =>
                      rows.map((item) =>
                        item.id === row.id ? { ...item, description: e.target.value } : item,
                      ),
                    )
                  }
                  className="w-full"
                />
                <input
                  value={row.imageUrl ?? ""}
                  placeholder="Image URL"
                  aria-label={`${row.name} image URL`}
                  onChange={(e) =>
                    setRegionRows((rows) =>
                      rows.map((item) =>
                        item.id === row.id ? { ...item, imageUrl: e.target.value || null } : item,
                      ),
                    )
                  }
                  className="w-full"
                />
              </div>
              <code className="mt-2 block text-xs text-on-surface-variant sm:hidden">{row.slug}</code>
            </div>
          ))}
        </div>
      )}

      {section === "countries" && (
        <div className="space-y-4">
          <div
            aria-busy={pendingActions.has("country:new")}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
          >
            <span className="mb-3 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              New country
            </span>
            {regionOptions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Create a region first before adding countries.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[6rem_1fr_6rem_10rem_auto] sm:items-end">
                <input
                  value={newCountry.iso2}
                  placeholder="ISO2"
                  aria-label="New country ISO2"
                  maxLength={2}
                  onChange={(e) => setNewCountry({ ...newCountry, iso2: e.target.value.toUpperCase() })}
                  className="w-full uppercase"
                />
                <input
                  value={newCountry.name}
                  placeholder="Name"
                  aria-label="New country name"
                  onChange={(e) => setNewCountry({ ...newCountry, name: e.target.value })}
                  className="w-full"
                />
                <input
                  value={newCountry.iso3}
                  placeholder="ISO3"
                  aria-label="New country ISO3"
                  maxLength={3}
                  onChange={(e) => setNewCountry({ ...newCountry, iso3: e.target.value.toUpperCase() })}
                  className="w-full uppercase"
                />
                <select
                  value={newCountry.regionId}
                  aria-label="New country region"
                  onChange={(e) => setNewCountry({ ...newCountry, regionId: e.target.value })}
                  className="w-full"
                >
                  {regionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={
                    pendingActions.has("country:new") ||
                    !newCountry.iso2.trim() ||
                    !newCountry.name.trim() ||
                    !newCountry.regionId
                  }
                  onClick={() => void addCountry()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10"
                aria-label="Search countries"
              />
            </div>
            <select
              value={countryRegionFilter}
              onChange={(e) => setCountryRegionFilter(e.target.value)}
              aria-label="Filter countries by region"
              className="w-full"
            >
              <option value="">All regions</option>
              {regionRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.countryCount})
                </option>
              ))}
            </select>
          </div>

          {(searchQuery.trim() || countryRegionFilter) && (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                Showing {filteredCountries.length} of {countryRows.length}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setCountryRegionFilter("")
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
              >
                <X size={14} aria-hidden="true" />
                Clear filters
              </button>
            </div>
          )}

          {filteredCountries.length === 0 && (
            <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-10 text-center">
              <p className="text-sm text-on-surface-variant">
                {searchQuery.trim() && countryRegionFilter
                  ? `No countries matching "${searchQuery}" in "${regionRows.find((r) => r.id === countryRegionFilter)?.name ?? "selected region"}".`
                  : searchQuery.trim()
                    ? `No countries matching "${searchQuery}".`
                    : countryRegionFilter
                      ? `No countries in "${regionRows.find((r) => r.id === countryRegionFilter)?.name ?? "selected region"}" yet.`
                      : regionOptions.length === 0
                        ? "No countries found. Create a region first, then add countries above."
                        : "No countries yet. Add your first country using the form above."}
              </p>
            </div>
          )}

          {filteredCountries.map((row) => (
            <div
              key={row.iso2}
              aria-busy={pendingActions.has(`country:${row.iso2}`)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 items-center rounded-md bg-surface-container-high px-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant">
                  {row.iso2}
                </span>
                <input
                  value={row.name}
                  aria-label={`${row.name} name`}
                  onChange={(e) =>
                    setCountryRows((rows) =>
                      rows.map((item) =>
                        item.iso2 === row.iso2 ? { ...item, name: e.target.value } : item,
                      ),
                    )
                  }
                  className="min-w-0 flex-1"
                />
                <input
                  value={row.iso3 ?? ""}
                  placeholder="ISO3"
                  aria-label={`${row.name} ISO3`}
                  onChange={(e) =>
                    setCountryRows((rows) =>
                      rows.map((item) =>
                        item.iso2 === row.iso2
                          ? { ...item, iso3: e.target.value.toUpperCase() || null }
                          : item,
                      ),
                    )
                  }
                  className="w-20 uppercase"
                  maxLength={3}
                />
                <select
                  value={row.regionId}
                  aria-label={`${row.name} region`}
                  onChange={(e) => updateCountryRegion(row.iso2, e.target.value)}
                  className="w-full max-w-[10rem]"
                >
                  {regionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <MapPin size={14} aria-hidden="true" />
                  {row.spotCount} spots, {row.eventCount} events
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingActions.has(`country:${row.iso2}`)}
                    onClick={() => void saveCountry(row)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${row.name}`}
                    disabled={pendingActions.has(`country:${row.iso2}`)}
                    onClick={() => void removeCountry(row.iso2)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-error bg-surface-container-lowest px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete?.label ?? ""}
        description={pendingDelete?.description ?? ""}
      />
    </section>
  )
}
