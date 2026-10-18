import { describe, expect, it } from "vitest"
import {
  buildEventFormData,
  buildInitialEventState,
  validateEventFormState,
  type EventFormState,
} from "./event-form-model"

function validState(
  overrides: Partial<EventFormState> = {},
): EventFormState {
  return {
    ...buildInitialEventState(),
    name: "FISE 2026",
    url: "https://example.com/fise",
    image: { imageUrl: "https://example.com/fise.jpg", file: null },
    startDate: "2026-07-01",
    endDate: "2026-07-05",
    city: "Montpellier",
    country: "France",
    latitude: "43.61",
    longitude: "3.88",
    sports: ["Skateboard", "BMX"],
    ...overrides,
  }
}

describe("event form model", () => {
  it("accepts an external image URL without requiring a file", () => {
    const state = validState()

    expect(validateEventFormState(state)).toEqual({})

    const formData = buildEventFormData(state, "create")
    expect(formData.get("imageUrl")).toBe("https://example.com/fise.jpg")
    expect(formData.get("image")).toBeNull()
    expect(formData.getAll("sports")).toEqual(["Skateboard", "BMX"])
  })

  it("sends file-only media using the shared upload key", () => {
    const file = new File(["image"], "fise.jpg", { type: "image/jpeg" })
    const state = validState({ image: { imageUrl: "", file } })
    const formData = buildEventFormData(state, "create")

    expect(formData.get("imageUrl")).toBeNull()
    expect(formData.get("image")).toBe(file)
  })

  it("keeps edit clearing semantics for supported nullable fields", () => {
    const state = validState({
      endDate: "",
      instagram: "",
      youtube: "",
      featured: false,
      sports: [],
    })
    const formData = buildEventFormData(state, "edit")

    expect(formData.get("endDate")).toBe("")
    expect(formData.get("instagram")).toBe("")
    expect(formData.get("youtube")).toBe("")
    expect(formData.get("featured")).toBe("off")
    expect(formData.getAll("sports")).toEqual([])
  })

  it("reports missing coordinates and invalid date ranges", () => {
    const errors = validateEventFormState(
      validState({
        latitude: "",
        longitude: "",
        endDate: "2026-06-30",
      }),
    )

    expect(errors.location).toContain("required")
    expect(errors.endDate).toContain("on or after")
  })
})
