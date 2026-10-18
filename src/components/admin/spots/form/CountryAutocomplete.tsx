"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { useCountries, type CountryOption } from "../hooks/useCountries"

export interface CountrySelection {
  name: string
  code: string
}

interface CountryGroup {
  region: string
  options: readonly CountryOption[]
}

interface CountryAutocompleteProps {
  value: CountrySelection
  onChange: (next: CountrySelection) => void
  onError?: (message: string) => void
  id?: string
  invalid?: boolean
  disabled?: boolean
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-outline focus:outline-none disabled:opacity-50 sm:text-sm"

function groupByRegion(
  items: readonly CountryOption[],
): readonly CountryGroup[] {
  const map = new Map<string, CountryOption[]>()
  for (const item of items) {
    const list = map.get(item.region)
    if (list) list.push(item)
    else map.set(item.region, [item])
  }
  return [...map.entries()].map(([region, options]) => ({ region, options }))
}

export function CountryAutocomplete({
  value,
  onChange,
  onError,
  id: idProp,
  invalid,
  disabled,
}: CountryAutocompleteProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const listboxId = `${id}-listbox`
  const statusId = `${id}-status`

  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const lastSyncedNameRef = useRef<string>(value.name)

  const [inputText, setInputText] = useState<string>(value.name)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const { items, isLoading, error } = useCountries(inputText)

  useEffect(() => {
    if (value.name !== lastSyncedNameRef.current) {
      lastSyncedNameRef.current = value.name
      setInputText(value.name)
    }
  }, [value.name])

  useEffect(() => {
    if (error) onError?.(error)
  }, [error, onError])

  const groups = useMemo(() => groupByRegion(items), [items])
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups])

  useEffect(() => {
    if (activeIndex >= flat.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIndex(0)
    }
  }, [activeIndex, flat.length])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      if (inputRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [isOpen])

  const selectOption = (option: CountryOption) => {
    lastSyncedNameRef.current = option.name
    setInputText(option.name)
    setIsOpen(false)
    onChange({ name: option.name, code: option.iso2 })
  }

  const openDropdown = () => {
    if (disabled) return
    setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!isOpen) {
        openDropdown()
        return
      }
      if (flat.length > 0) {
        setActiveIndex((i) => (i + 1) % flat.length)
      }
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!isOpen) {
        openDropdown()
        return
      }
      if (flat.length > 0) {
        setActiveIndex((i) => (i - 1 + flat.length) % flat.length)
      }
      return
    }
    if (e.key === "Enter") {
      if (isOpen && flat.length > 0) {
        const option = flat[activeIndex]
        if (option) {
          e.preventDefault()
          selectOption(option)
        }
      }
      return
    }
    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault()
        setIsOpen(false)
        setInputText(value.name)
        lastSyncedNameRef.current = value.name
      }
      return
    }
  }

  const handleFocus = () => {
    openDropdown()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)
    setIsOpen(true)
    setActiveIndex(0)
  }

  const handleClear = () => {
    lastSyncedNameRef.current = ""
    setInputText("")
    setActiveIndex(0)
    onChange({ name: "", code: "" })
    inputRef.current?.focus()
  }

  const showDropdown = isOpen && !disabled
  const trimmedQuery = inputText.trim()
  const activeOption = flat[activeIndex]
  const activeId =
    showDropdown && activeOption
      ? `${listboxId}-opt-${activeOption.iso2}`
      : undefined

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={inputText}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={error ? statusId : undefined}
          placeholder="Search country…"
          className={cn(FIELD_CLASSES, "pr-16")}
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
          {value.name.length > 0 && !disabled ? (
            <button
              type="button"
              tabIndex={0}
              onClick={handleClear}
              aria-label="Clear country"
              className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-secondary transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <X size={12} aria-hidden="true" />
            </button>
          ) : null}
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={cn(
              "text-secondary transition-transform",
              isOpen ? "rotate-180" : "",
            )}
          />
        </div>
      </div>

      {showDropdown ? (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label="Countries"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-none"
        >
          {isLoading ? (
            <p
              role="presentation"
              className="px-3 py-2 font-display text-[10px] uppercase tracking-widest text-secondary"
            >
              Searching…
            </p>
          ) : null}
          {!isLoading && flat.length === 0 ? (
            <p
              role="presentation"
              className="px-3 py-2 text-[10px] text-secondary"
            >
              {trimmedQuery.length === 0
                ? "Type to search countries."
                : `No country matches “${trimmedQuery}”.`}
            </p>
          ) : null}
          {!isLoading && flat.length > 0
            ? groups.map((group, groupIndex) => (
                <div
                  key={group.region}
                  role="group"
                  aria-label={group.region}
                  className={cn(
                    "border-t border-outline-variant",
                    groupIndex === 0 ? "border-t-0" : "",
                  )}
                >
                  <div className="px-3 pt-2 font-display text-[9px] font-bold uppercase tracking-widest text-secondary">
                    {group.region}
                  </div>
                  <ul className="pb-1">
                    {group.options.map((option) => {
                      const flatIndex = flat.indexOf(option)
                      const isActive = flatIndex === activeIndex
                      const isSelected = option.iso2 === value.code
                      return (
                        <li
                          key={option.iso2}
                          id={`${listboxId}-opt-${option.iso2}`}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectOption(option)
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs",
                            isActive
                              ? "bg-primary text-surface"
                              : "text-on-surface",
                          )}
                        >
                          <span className="flex-1">{option.name}</span>
                          <span
                            className={cn(
                              "font-display text-[10px] uppercase tracking-widest",
                              isActive ? "text-surface" : "text-secondary",
                            )}
                          >
                            {option.iso2}
                          </span>
                          {isSelected ? (
                            <Check
                              size={12}
                              aria-hidden="true"
                              className={cn(
                                isActive ? "text-surface" : "text-primary",
                              )}
                            />
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            : null}
        </div>
      ) : null}

      {error ? (
        <p
          id={statusId}
          role="alert"
          className="mt-1 font-display text-[10px] uppercase tracking-widest text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
