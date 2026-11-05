"use client";

/**
 * League form primitives on the shared recipes (DESIGN.md pages.league):
 * LABEL labels, INPUT / TEXTAREA controls, CARD fieldsets. Used by the
 * create flow and the organizer console so both forms read the same.
 */

import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  BODY,
  CARD,
  CARD_TITLE,
  INPUT,
  LABEL,
  TEXTAREA,
} from "@/components/ui/recipes";

function describedBy(id: string, hint?: string, error?: string) {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const content = (
    <>
      {children}
      {required ? (
        <>
          <span aria-hidden="true"> *</span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={`mb-1.5 block ${LABEL}`}>
      {content}
    </label>
  ) : (
    <p className={`mb-1.5 ${LABEL}`}>{content}</p>
  );
}

export function FieldMessages({
  id,
  hint,
  error,
}: {
  id: string;
  hint?: string;
  error?: string;
}) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs font-semibold text-error"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

interface BaseFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  error,
  hint,
  autoComplete,
  min,
  max,
  disabled,
  className,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={INPUT}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  hint,
  rows = 3,
  className,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${TEXTAREA} resize-y`}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
  hint,
  disabled,
  className,
}: BaseFieldProps & {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${INPUT} appearance-none pr-10`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-secondary"
        />
      </div>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/** A form section: CARD fieldset with a CARD_TITLE legend and BODY intro. */
export function FormSection({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={`${CARD} min-w-0 sm:p-6`}>
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true" className={`flex items-center gap-2 ${CARD_TITLE}`}>
        {Icon ? <Icon size={18} className="text-secondary" /> : null}
        {title}
      </div>
      {intro ? <p className={`mt-1.5 max-w-2xl ${BODY}`}>{intro}</p> : null}
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}
