"use client"

import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react"
import { Search, ShieldCheck, UserRound, Users } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { showToast } from "@/hooks/ui/useToast"
import { formatUtcDate } from "@/lib/utils/format-date"
import { ROLE_SLUGS, type RoleSlug } from "@/lib/auth/roles"
import type {
  AdminRoleOption,
  AdminUserRoleAssignment,
  AdminUserSummary,
} from "@/lib/repositories/admin/admin-user-repository"

interface AdminUserManagerProps {
  initialUsers: readonly AdminUserSummary[]
  availableRoles: readonly AdminRoleOption[]
  initialNextCursor: string | null
  initialQuery: string
  initialRole: RoleSlug | ""
}

interface UserListResponse {
  items: readonly AdminUserSummary[]
  nextCursor: string | null
  availableRoles: readonly AdminRoleOption[]
}

interface PendingRoleChange {
  userId: string
  roles: readonly RoleSlug[]
  removedNames: readonly string[]
}

function isRoleSlug(value: string): value is RoleSlug {
  return ROLE_SLUGS.includes(value as RoleSlug)
}

function roleSlugs(user: AdminUserSummary): RoleSlug[] {
  return user.roles.flatMap((role) => (isRoleSlug(role.slug) ? [role.slug] : []))
}

function roleLabel(slug: string): string {
  if (slug === "admin") return "Administrator"
  if (slug === "spot_curator") return "Spot Curator"
  if (slug === "event_curator") return "Event Curator"
  if (slug === "trick_curator") return "Trick Curator"
  return "Curator"
}

function roleBadgeClass(slug: string): string {
  if (slug === "admin") return "border-outline-variant bg-surface-container-high text-on-surface"
  if (slug === "spot_curator") return "border-outline-variant bg-surface-container-high text-on-surface"
  if (slug === "event_curator") return "border-outline-variant bg-surface-container-high text-on-surface"
  if (slug === "trick_curator") return "border-outline-variant bg-surface-container-high text-on-surface"
  return "border-outline-variant bg-surface-container-high text-secondary"
}

interface CuratorScopes {
  countryCodes: readonly string[]
  disciplineSlugs: readonly string[]
}

interface CuratorOptions {
  countries: readonly { iso2: string; name: string; region: string }[]
  disciplines: readonly { slug: string; name: string }[]
}

function userRoleAssignments(
  user: AdminUserSummary,
): readonly AdminUserRoleAssignment[] {
  return user.roles
}

export function AdminUserManager({
  initialUsers,
  availableRoles: initialAvailableRoles,
  initialNextCursor,
  initialQuery,
  initialRole,
}: AdminUserManagerProps) {
  const searchId = useId()
  const roleFilterId = useId()
  const router = useRouter()
  const pathname = usePathname()
  const [users, setUsers] = useState<readonly AdminUserSummary[]>(initialUsers)
  const [availableRoles, setAvailableRoles] = useState(initialAvailableRoles)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [query, setQuery] = useState(initialQuery)
  const [roleFilter, setRoleFilter] = useState<RoleSlug | "">(initialRole)
  const deferredQuery = useDeferredValue(query)
  const [isPending, startTransition] = useTransition()
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [draftRoles, setDraftRoles] = useState<readonly RoleSlug[]>([])
  const [pendingChange, setPendingChange] = useState<PendingRoleChange | null>(
    null,
  )
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopesByUser, setScopesByUser] = useState<Record<string, CuratorScopes>>({})
  const [scopesLoading, setScopesLoading] = useState<string | null>(null)
  const [curatorOptions, setCuratorOptions] = useState<CuratorOptions | null>(null)
  const [draftCountryCodes, setDraftCountryCodes] = useState<readonly string[]>([])
  const [draftDisciplineSlugs, setDraftDisciplineSlugs] = useState<readonly string[]>([])
  const [savingScopes, setSavingScopes] = useState<string | null>(null)
  const [scopesFilter, setScopesFilter] = useState("")
  const listRequest = useRef<{
    generation: number
    controller: AbortController | null
  }>({ generation: 0, controller: null })

  const invalidateListRequest = () => {
    listRequest.current.generation += 1
    listRequest.current.controller?.abort()
    listRequest.current.controller = null
    setLoadingMore(false)
    setNextCursor(null)
  }

  useEffect(() => {
    if (deferredQuery === initialQuery) return
    const params = new URLSearchParams()
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim())
    if (roleFilter) params.set("role", roleFilter)
    const timer = window.setTimeout(() => {
      const search = params.toString()
      startTransition(() => {
        router.replace(`${pathname}${search ? `?${search}` : ""}`, {
          scroll: false,
        })
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [deferredQuery, initialQuery, pathname, roleFilter, router])

  useEffect(
    () => () => {
      listRequest.current.generation += 1
      listRequest.current.controller?.abort()
    },
    [],
  )

  const ensureCuratorOptions = async () => {
    if (curatorOptions) return curatorOptions
    const res = await fetch("/api/admin/curator-options")
    if (!res.ok) throw new Error("Unable to load curator options")
    const data = (await res.json()) as CuratorOptions
    setCuratorOptions(data)
    return data
  }

  const loadScopes = async (userId: string) => {
    setScopesLoading(userId)
    try {
      await ensureCuratorOptions()
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/curator-scopes`)
      if (!res.ok) throw new Error("Unable to load scopes")
      const data = (await res.json()) as CuratorScopes
      setScopesByUser((prev) => ({ ...prev, [userId]: data }))
      setDraftCountryCodes(data.countryCodes)
      setDraftDisciplineSlugs(data.disciplineSlugs)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Unable to load scopes", "error")
    } finally {
      setScopesLoading(null)
    }
  }

  const beginEditing = (user: AdminUserSummary) => {
    setEditingUserId(user.id)
    setDraftRoles(roleSlugs(user))
    setPendingChange(null)
    setError(null)
    // preload scopes if user already has a scoped role or legacy curator
    const hasScoped = roleSlugs(user).some((s) => ["spot_curator","event_curator","trick_curator","curator"].includes(s))
    if (hasScoped && !scopesByUser[user.id]) {
      void loadScopes(user.id)
    } else if (scopesByUser[user.id]) {
      setDraftCountryCodes(scopesByUser[user.id]!.countryCodes)
      setDraftDisciplineSlugs(scopesByUser[user.id]!.disciplineSlugs)
    }
  }

  const cancelEditing = () => {
    if (savingUserId) return
    setEditingUserId(null)
    setDraftRoles([])
    setPendingChange(null)
    setError(null)
  }

  const toggleRole = (slug: RoleSlug) => {
    setDraftRoles((current) =>
      current.includes(slug)
        ? current.filter((role) => role !== slug)
        : [...current, slug],
    )
    setPendingChange(null)
    setError(null)
  }

  const persistRoles = async (userId: string, rolesToSave: readonly RoleSlug[]) => {
    setSavingUserId(userId)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/roles`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles: rolesToSave }),
        },
      )
      if (response.status === 401) {
        router.push("/login")
        throw new Error("Your session has expired")
      }
      const body = (await response.json().catch(() => null)) as
        | AdminUserRoleAssignment[]
        | { error?: string }
        | null
      if (!response.ok) {
        throw new Error(
          body && !Array.isArray(body) && body.error
            ? body.error
            : `Access update failed (${response.status})`,
        )
      }
      const assignments = Array.isArray(body) ? body : []
      setUsers((current) =>
        current.flatMap((user) => {
          if (user.id !== userId) return [user]
          if (roleFilter && !rolesToSave.includes(roleFilter)) return []
          return [{ ...user, roles: assignments }]
        }),
      )
      setEditingUserId(null)
      setDraftRoles([])
      setPendingChange(null)
      showToast("Access updated", "success")
      router.refresh()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Access update failed"
      setError(message)
      showToast(message, "error")
    } finally {
      setSavingUserId(null)
    }
  }

  const submitRoles = (user: AdminUserSummary) => {
    const currentRoles = roleSlugs(user)
    const removedNames = currentRoles
      .filter((role) => !draftRoles.includes(role))
      .map(roleLabel)
    if (removedNames.length > 0) {
      setPendingChange({
        userId: user.id,
        roles: draftRoles,
        removedNames,
      })
      return
    }
    startTransition(() => {
      void persistRoles(user.id, draftRoles)
    })
  }

  const loadMore = () => {
    if (!nextCursor || loadingMore || isPending) return
    const generation = listRequest.current.generation
    const controller = new AbortController()
    listRequest.current.controller = controller
    setLoadingMore(true)
    setError(null)
    const params = new URLSearchParams({ cursor: nextCursor })
    if (query.trim()) params.set("q", query.trim())
    if (roleFilter) params.set("role", roleFilter)
    void fetch(`/api/admin/users?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login")
          throw new Error("Your session has expired")
        }
        const body = (await response.json().catch(() => null)) as
          | UserListResponse
          | { error?: string }
          | null
        if (!response.ok || !body || !("items" in body)) {
          throw new Error(
            body && "error" in body && body.error
              ? body.error
              : `Unable to load more users (${response.status})`,
          )
        }
        if (generation !== listRequest.current.generation) return
        setUsers((current) => [...current, ...body.items])
        setNextCursor(body.nextCursor)
        setAvailableRoles(body.availableRoles)
      })
      .catch((caught) => {
        if (
          (caught instanceof DOMException && caught.name === "AbortError") ||
          generation !== listRequest.current.generation
        ) {
          return
        }
        const message = caught instanceof Error ? caught.message : "Unable to load more users"
        setError(message)
        showToast(message, "error")
      })
      .finally(() => {
        if (generation === listRequest.current.generation) {
          listRequest.current.controller = null
          setLoadingMore(false)
        }
      })
  }

  const hasFilters = Boolean(query.trim() || roleFilter)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div>
          <label
            htmlFor={searchId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Search accounts
          </label>
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                invalidateListRequest()
              }}
              placeholder="Name or email…"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3 pl-10 pr-3 text-base text-on-surface focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor={roleFilterId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Role
          </label>
          <select
            id={roleFilterId}
            value={roleFilter}
            onChange={(event) => {
              const value = event.target.value
              const nextRole = isRoleSlug(value) ? value : ""
              setRoleFilter(nextRole)
              invalidateListRequest()
              const params = new URLSearchParams()
              if (query.trim()) params.set("q", query.trim())
              if (nextRole) params.set("role", nextRole)
              const search = params.toString()
              startTransition(() => {
                router.replace(`${pathname}${search ? `?${search}` : ""}`, {
                  scroll: false,
                })
              })
            }}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base text-on-surface focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"
          >
            <option value="">All roles</option>
            {availableRoles.map((role) => (
              <option key={role.slug} value={role.slug}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3">
        <p className="text-xs text-secondary" aria-live="polite">
          {users.length} account{users.length === 1 ? "" : "s"} shown
          {nextCursor ? "+" : ""}
          {hasFilters ? " for this filter" : ""}.
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setRoleFilter("")
              invalidateListRequest()
              startTransition(() => router.replace(pathname, { scroll: false }))
            }}
            className="text-xs font-bold text-secondary underline-offset-2 hover:text-on-surface hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-card border border-error/40 bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      ) : null}

      {users.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-10 text-center"
        >
          <Users size={22} aria-hidden="true" className="mx-auto text-secondary" />
          <p className="mt-3 font-display text-base font-bold uppercase tracking-widest text-on-surface">
            No accounts found
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-secondary">
            Try a different name, email, or role filter. Accounts must exist in
            Supabase Auth before they can receive an Open Spot role.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const editing = editingUserId === user.id
            const assignments = userRoleAssignments(user)
            return (
              <article
                key={user.id}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest"
              >
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(13rem,1fr)_auto] md:items-center md:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-display text-xs font-bold text-secondary">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-on-surface">
                        {user.displayName}
                      </h2>
                      <p className="truncate text-xs text-secondary">{user.email || "Email unavailable"}</p>
                      <p className="mt-1 font-display text-[9px] uppercase tracking-wider text-secondary">
                        Joined {user.createdAt ? formatUtcDate(user.createdAt) : "Date unavailable"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                      Current access
                    </p>
                    {assignments.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignments.map((role) => (
                          <span
                            key={role.slug}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow ${roleBadgeClass(role.slug)}`}
                          >
                            {role.slug === "admin" ? (
                              <ShieldCheck size={11} aria-hidden="true" />
                            ) : (
                              <UserRound size={11} aria-hidden="true" />
                            )}
                            {role.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-secondary">No elevated access</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => (editing ? cancelEditing() : beginEditing(user))}
                    disabled={Boolean(savingUserId)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editing ? "Close editor" : "Manage access"}
                  </button>
                </div>

                {editing ? (
                  <div
                    className="border-t border-outline-variant bg-surface-container-low p-4 md:p-5"
                    aria-busy={savingUserId === user.id}
                  >
                    <fieldset className="space-y-2" disabled={Boolean(savingUserId)}>
                      <legend className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                        Roles for {user.displayName}
                      </legend>
                      <div className="grid gap-2 md:grid-cols-2">
                        {availableRoles.map((role) => {
                          if (!isRoleSlug(role.slug)) return null
                          const slug = role.slug
                          const checked = draftRoles.includes(slug)
                          return (
                            <label
                              key={role.slug}
                              className="flex cursor-pointer items-start gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:border-outline has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRole(slug)}
                                className="mt-0.5 size-4 accent-primary"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-bold text-on-surface">
                                  {role.name}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-secondary">
                                  {role.description}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>

                    {/* Scoped curator scopes */}
                    {(() => {
                      const needsCountry = draftRoles.some((r) => ["spot_curator","event_curator"].includes(r))
                      const needsDiscipline = draftRoles.includes("trick_curator")
                      if (!needsCountry && !needsDiscipline && !["curator"].some((r) => draftRoles.includes(r as RoleSlug))) return null
                      const isLoading = scopesLoading === user.id
                      const scopes = scopesByUser[user.id]
                      return (
                        <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">Curator scopes</p>
                            {scopes ? (
                              <button type="button" onClick={() => void loadScopes(user.id)} disabled={isLoading} className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline disabled:opacity-50">
                                {isLoading ? "Loading…" : "Reload"}
                              </button>
                            ) : (
                              <button type="button" onClick={() => void loadScopes(user.id)} disabled={isLoading} className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline disabled:opacity-50">
                                {isLoading ? "Loading…" : "Load scopes"}
                              </button>
                            )}
                          </div>
                          {isLoading && !scopes ? <p className="mt-2 text-xs text-secondary">Loading scopes…</p> : null}
                          {scopes || draftCountryCodes.length>0 || draftDisciplineSlugs.length>0 ? (
                            <div className="mt-3 space-y-4">
                              {(needsCountry || draftRoles.includes("curator" as RoleSlug)) ? (
                                <div>
                                  <label className="mb-1 block font-display text-[10px] font-bold uppercase tracking-wider text-secondary">Countries (spots & events by ISO2)</label>
                                  <input
                                    type="text"
                                    value={scopesFilter}
                                    onChange={(e) => setScopesFilter(e.target.value)}
                                    placeholder="Filter countries…"
                                    className="mb-2 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs"
                                  />
                                  <div className="max-h-40 overflow-auto rounded-md border border-outline-variant bg-surface-container-low p-2">
                                    {(curatorOptions?.countries ?? []).filter((c) => !scopesFilter || c.name.toLowerCase().includes(scopesFilter.toLowerCase()) || c.iso2.toLowerCase().includes(scopesFilter.toLowerCase())).map((c) => {
                                      const checked = draftCountryCodes.includes(c.iso2)
                                      return (
                                        <label key={c.iso2} className="flex items-center gap-2 py-1 text-xs">
                                          <input type="checkbox" checked={checked} onChange={(e) => setDraftCountryCodes((prev) => e.target.checked ? [...prev, c.iso2] : prev.filter((x) => x !== c.iso2))} className="size-3.5 accent-primary" />
                                          <span className="min-w-0 flex-1 truncate">{c.name} <span className="font-display text-[10px] text-secondary">({c.iso2})</span></span>
                                          <span className="text-[10px] text-secondary">{c.region}</span>
                                        </label>
                                      )
                                    })}
                                    {curatorOptions && curatorOptions.countries.length===0 ? <p className="text-xs text-secondary">No countries</p> : null}
                                    {!curatorOptions ? <p className="text-xs text-secondary">Load scopes to see countries</p> : null}
                                  </div>
                                  <p className="mt-1 text-[10px] text-secondary">{draftCountryCodes.length} selected</p>
                                </div>
                              ) : null}
                              {(needsDiscipline || draftRoles.includes("curator" as RoleSlug)) ? (
                                <div>
                                  <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-wider text-secondary">Disciplines (tricks by sport)</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(curatorOptions?.disciplines ?? []).map((d) => {
                                      const checked = draftDisciplineSlugs.includes(d.slug)
                                      return (
                                        <label key={d.slug} className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.99] ${checked ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-secondary hover:border-outline hover:text-on-surface"}`}>
                                          <input type="checkbox" checked={checked} onChange={(e) => setDraftDisciplineSlugs((prev) => e.target.checked ? [...prev, d.slug] : prev.filter((x) => x !== d.slug))} className="size-3 accent-primary" />
                                          {d.name}
                                          <span className="font-display text-[10px] text-secondary">({d.slug})</span>
                                        </label>
                                      )
                                    })}
                                    {!curatorOptions ? <p className="text-xs text-secondary">Load scopes to see disciplines</p> : null}
                                  </div>
                                  <p className="mt-1 text-[10px] text-secondary">{draftDisciplineSlugs.length} selected</p>
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={savingScopes === user.id}
                                  onClick={async () => {
                                    setSavingScopes(user.id)
                                    try {
                                      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/curator-scopes`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ countryCodes: draftCountryCodes, disciplineSlugs: draftDisciplineSlugs }),
                                      })
                                      const body = await res.json().catch(() => null)
                                      if (!res.ok) throw new Error((body as { error?: string })?.error ?? `Save failed (${res.status})`)
                                      setScopesByUser((prev) => ({ ...prev, [user.id]: body as CuratorScopes }))
                                      showToast("Scopes updated", "success")
                                    } catch (e) {
                                      showToast(e instanceof Error ? e.message : "Scopes update failed", "error")
                                    } finally { setSavingScopes(null) }
                                  }}
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:opacity-50"
                                >
                                  {savingScopes === user.id ? "Saving…" : "Save scopes"}
                                </button>
                                <button type="button" onClick={() => scopes && (setDraftCountryCodes(scopes.countryCodes), setDraftDisciplineSlugs(scopes.disciplineSlugs))} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]">Reset</button>
                              </div>
                              <p className="text-[10px] leading-4 text-secondary">Scopes are enforced for spot_curator/event_curator (country) and trick_curator (discipline). Legacy curator bypasses scopes.</p>
                            </div>
                          ) : null}
                        </div>
                      )
                    })()}

                    {assignments.length > 0 ? (
                      <p className="mt-3 text-xs leading-5 text-secondary">
                        Existing assignments are retained only when their role
                        remains selected. Saving applies the complete set above.
                      </p>
                    ) : null}

                    {pendingChange?.userId === user.id ? (
                      <div
                        role="alert"
                        className="mt-4 rounded-card border border-error/40 bg-error-container p-3 text-sm text-on-error-container"
                      >
                        <p className="font-bold">Confirm access removal</p>
                        <p className="mt-1 leading-5">
                          This will remove {pendingChange.removedNames.join(" and ")} access from {user.displayName}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingChange(null)}
                            disabled={Boolean(savingUserId)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                          >
                            Keep access
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              startTransition(() => {
                                void persistRoles(user.id, pendingChange.roles)
                              })
                            }}
                            autoFocus
                            disabled={Boolean(savingUserId)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-error bg-error px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-error transition-colors duration-150 ease-out hover:bg-error/90 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingUserId === user.id ? "Saving…" : "Confirm removal"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[10px] leading-4 text-secondary">
                        Role changes take effect on the user&apos;s next authorization read.
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={Boolean(savingUserId)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => submitRoles(user)}
                          disabled={Boolean(savingUserId) || pendingChange !== null}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingUserId === user.id ? "Saving…" : "Save access"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center border-t border-outline-variant pt-5">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore || isPending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Loading users…" : "Load more users"}
          </button>
        </div>
      ) : null}
    </div>
  )
}
