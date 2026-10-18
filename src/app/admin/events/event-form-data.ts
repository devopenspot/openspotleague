/**
 * Event form transport helpers are kept here as the route-level contract
 * reference. The client form uses the same functions directly from the
 * component module so create and edit cannot build different payloads.
 */
export {
  buildEventFormData,
  buildInitialEventState,
  stateFromEvent,
  validateEventFormState,
} from "@/components/admin/events/form/event-form-model"

/**
 * These fields are converted to `null` by the event API when their edit
 * inputs are cleared. Other empty PATCH values intentionally retain the
 * repository's existing preserve-on-undefined behavior.
 */
export const NULLABLE_STRING_FIELDS: ReadonlySet<string> = new Set([
  "instagram",
  "youtube",
])
